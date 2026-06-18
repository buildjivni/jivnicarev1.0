import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { generatePhoneHash } from "@/lib/services/crypto.service";
import { createAuditLog } from "@/lib/services/audit.service";
import { sendNotification } from "@/lib/services/notification.service";
import { TokenStatus, QueueStatus, QueueType, TokenType, AuditAction, Role } from "@prisma/client";
import crypto from "crypto";

const VALID_TRANSITIONS: Record<TokenStatus, TokenStatus[]> = {
  BOOKED: [TokenStatus.AWAITING_ARRIVAL, TokenStatus.CANCELLED, TokenStatus.EXPIRED],
  AWAITING_ARRIVAL: [TokenStatus.PAYMENT_PENDING, TokenStatus.READY, TokenStatus.CANCELLED, TokenStatus.EXPIRED],
  PAYMENT_PENDING: [TokenStatus.READY, TokenStatus.CANCELLED],
  READY: [TokenStatus.CALLED, TokenStatus.NO_SHOW, TokenStatus.CANCELLED],
  CALLED: [TokenStatus.IN_CONSULTATION, TokenStatus.NO_SHOW],
  IN_CONSULTATION: [TokenStatus.COMPLETED],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
  EXPIRED: [],
};

export class QueueService {
  /**
   * Fetches active queue with 30s Redis Caching
   */
  async getQueue(queueId: string) {
    const cacheKey = `queue:${queueId}`;
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        return typeof cached === "string" ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      console.error("Redis read failed in getQueue:", err);
    }

    const queue = await prisma.dailyQueue.findUnique({
      where: { id: queueId },
      include: {
        tokens: {
          where: {
            status: {
              notIn: [TokenStatus.CANCELLED, TokenStatus.EXPIRED],
            },
          },
          orderBy: { tokenNumber: "asc" },
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        doctor: {
          select: {
            name: true,
            speciality: true,
            clinicName: true,
          },
        },
      },
    });

    if (queue) {
      try {
        await redis.set(cacheKey, JSON.stringify(queue), { ex: 30 });
      } catch (err) {
        console.error("Redis write failed in getQueue:", err);
      }
    }

    return queue;
  }

  /**
   * Enforces State Machine transitions & invalidates cache
   */
  async transition(tokenId: string, fromStatus: TokenStatus, toStatus: TokenStatus, operatorId?: string) {
    if (operatorId) {
      const operator = await prisma.user.findUnique({ where: { id: operatorId } });
      if (!operator || operator.isBanned || !operator.isActive) {
        throw new Error("OPERATOR_SUSPENDED");
      }
    }

    const token = await prisma.queueToken.findUnique({
      where: { id: tokenId },
      include: {
        queue: true,
      },
    });

    if (!token) {
      throw new Error("Token not found.");
    }

    if (token.status !== fromStatus) {
      throw new Error(`State conflict: expected ${fromStatus}, found ${token.status}`);
    }

    const allowed = VALID_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Illegal state transition from ${fromStatus} to ${toStatus}`);
    }

    const updatedToken = await prisma.$transaction(async (tx) => {
      const ut = await tx.queueToken.update({
        where: { id: tokenId },
        data: {
          status: toStatus,
        },
      });

      // Invalidate Cache
      await redis.del(`queue:${token.queueId}`).catch(() => {});

      // If cancelled/no-show, dispatch waitlist FIFO
      if (toStatus === TokenStatus.CANCELLED || toStatus === TokenStatus.NO_SHOW) {
        const { bookingService } = await import("./booking.service");
        await bookingService.dispatchWaitlist(token.queue.doctorId, token.queue.date, tx);
      }

      return ut;
    });

    // Logging & Notifications
    createAuditLog({
      userId: operatorId || token.patientId || undefined,
      role: operatorId ? Role.DOCTOR : Role.PATIENT,
      action: AuditAction.UPDATE,
      entityType: "QueueToken",
      entityId: tokenId,
      oldValue: { status: fromStatus },
      newValue: { status: toStatus },
    });

    if (token.patientId) {
      let message = `Your token #${token.tokenNumber} status has changed to ${toStatus}.`;
      if (toStatus === TokenStatus.CALLED) {
        message = `Token #${token.tokenNumber} has been CALLED by the doctor. Please proceed to the consultation room.`;
      }
      sendNotification(token.patientId, message, "IN_APP").catch(() => {});
    }

    return updatedToken;
  }

  /**
   * Bidirectional Advance logic: CALL_NEXT or COMPLETE
   */
  async advance(queueId: string, action: "CALL_NEXT" | "COMPLETE", operatorId?: string) {
    if (operatorId) {
      const operator = await prisma.user.findUnique({ where: { id: operatorId } });
      if (!operator || operator.isBanned || !operator.isActive) {
        throw new Error("OPERATOR_SUSPENDED");
      }
    }

    const queue = await prisma.dailyQueue.findUnique({
      where: { id: queueId },
      include: {
        tokens: {
          orderBy: { tokenNumber: "asc" },
        },
      },
    });

    if (!queue) {
      throw new Error("Queue not found.");
    }

    return prisma.$transaction(async (tx) => {
      const activeTokens = await tx.queueToken.findMany({
        where: {
          queueId,
          status: {
            in: [TokenStatus.READY, TokenStatus.CALLED, TokenStatus.IN_CONSULTATION],
          },
        },
        orderBy: { tokenNumber: "asc" },
      });

      const inConsultationToken = activeTokens.find((t) => t.status === TokenStatus.IN_CONSULTATION);
      const calledToken = activeTokens.find((t) => t.status === TokenStatus.CALLED);
      const nextReadyToken = activeTokens.find((t) => t.status === TokenStatus.READY);

      if (action === "CALL_NEXT") {
        // 1. auto-complete current IN_CONSULTATION
        if (inConsultationToken) {
          await tx.queueToken.update({
            where: { id: inConsultationToken.id },
            data: { status: TokenStatus.COMPLETED },
          });
          createAuditLog({
            userId: operatorId,
            role: Role.DOCTOR,
            action: AuditAction.UPDATE,
            entityType: "QueueToken",
            entityId: inConsultationToken.id,
            oldValue: { status: TokenStatus.IN_CONSULTATION },
            newValue: { status: TokenStatus.COMPLETED },
          });
        }

        // 2. transition CALLED to IN_CONSULTATION
        if (calledToken) {
          await tx.queueToken.update({
            where: { id: calledToken.id },
            data: { status: TokenStatus.IN_CONSULTATION },
          });
          createAuditLog({
            userId: operatorId,
            role: Role.DOCTOR,
            action: AuditAction.UPDATE,
            entityType: "QueueToken",
            entityId: calledToken.id,
            oldValue: { status: TokenStatus.CALLED },
            newValue: { status: TokenStatus.IN_CONSULTATION },
          });
        }

        // 3. transition next READY to CALLED
        if (nextReadyToken) {
          await tx.queueToken.update({
            where: { id: nextReadyToken.id },
            data: { status: TokenStatus.CALLED },
          });
          createAuditLog({
            userId: operatorId,
            role: Role.DOCTOR,
            action: AuditAction.UPDATE,
            entityType: "QueueToken",
            entityId: nextReadyToken.id,
            oldValue: { status: TokenStatus.READY },
            newValue: { status: TokenStatus.CALLED },
          });

          if (nextReadyToken.patientId) {
            sendNotification(
              nextReadyToken.patientId,
              `Token #${nextReadyToken.tokenNumber} has been CALLED. Please proceed to the doctor's room.`,
              "IN_APP"
            ).catch(() => {});
          }
        }
      } else if (action === "COMPLETE") {
        // Complete current IN_CONSULTATION or CALLED token
        const targetToComplete = inConsultationToken || calledToken;
        if (targetToComplete) {
          await tx.queueToken.update({
            where: { id: targetToComplete.id },
            data: { status: TokenStatus.COMPLETED },
          });
          createAuditLog({
            userId: operatorId,
            role: Role.DOCTOR,
            action: AuditAction.UPDATE,
            entityType: "QueueToken",
            entityId: targetToComplete.id,
            oldValue: { status: targetToComplete.status },
            newValue: { status: TokenStatus.COMPLETED },
          });
        }

        // Auto-call next READY
        if (nextReadyToken) {
          await tx.queueToken.update({
            where: { id: nextReadyToken.id },
            data: { status: TokenStatus.CALLED },
          });
          createAuditLog({
            userId: operatorId,
            role: Role.DOCTOR,
            action: AuditAction.UPDATE,
            entityType: "QueueToken",
            entityId: nextReadyToken.id,
            oldValue: { status: TokenStatus.READY },
            newValue: { status: TokenStatus.CALLED },
          });

          if (nextReadyToken.patientId) {
            sendNotification(
              nextReadyToken.patientId,
              `Token #${nextReadyToken.tokenNumber} has been CALLED. Please proceed to the doctor's room.`,
              "IN_APP"
            ).catch(() => {});
          }
        }
      }

      // Invalidate Cache
      await redis.del(`queue:${queueId}`).catch(() => {});

      return { success: true };
    });
  }

  /**
   * Walk-in Creation by Receptionist (Bypasses daily booking cap limits but increments numbers)
   */
  async createWalkin(
    doctorId: string,
    date: Date,
    name: string,
    phone: string,
    address: string,
    operatorId?: string
  ) {
    if (operatorId) {
      const operator = await prisma.user.findUnique({ where: { id: operatorId } });
      if (!operator || operator.isBanned || !operator.isActive) {
        throw new Error("OPERATOR_SUSPENDED");
      }
    }

    const logicalDate = getLogicalDate(date);

    // 1. Fetch doctor details
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new Error("Doctor not found.");
    }

    // 2. Perform Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 2a. Find or create DailyQueue
      let dailyQueue = await tx.dailyQueue.findUnique({
        where: {
          doctorId_date_type: {
            doctorId,
            date: logicalDate,
            type: QueueType.REGULAR,
          },
        },
      });

      if (!dailyQueue) {
        dailyQueue = await tx.dailyQueue.create({
          data: {
            doctorId,
            date: logicalDate,
            type: QueueType.REGULAR,
            dailyLimit: doctor.dailyTokenLimit,
            status: QueueStatus.ACTIVE,
          },
        });
      }

      // 2b. Exclusively Lock
      await tx.$queryRaw`
        SELECT id FROM "daily_queues" WHERE id = ${dailyQueue.id} FOR UPDATE
      `;

      // Fetch fresh queue
      const lockedQueue = await tx.dailyQueue.findUnique({
        where: { id: dailyQueue.id },
      });
      if (!lockedQueue) throw new Error("Queue not found.");

      // 2c. Increment token count
      const newTokenNumber = lockedQueue.totalTokens + 1;
      await tx.dailyQueue.update({
        where: { id: lockedQueue.id },
        data: {
          totalTokens: newTokenNumber,
        },
      });

      // 2d. Silent Patient Auto-linking by phone number lookup
      const phoneHash = generatePhoneHash(phone);
      const user = await tx.user.findUnique({ where: { phoneHash } });

      // 2e. Create WALKIN Token (status starts as AWAITING_ARRIVAL since they are in-person)
      const token = await tx.queueToken.create({
        data: {
          queueId: lockedQueue.id,
          patientId: user ? user.id : null, // linked silently if user exists
          tokenNumber: newTokenNumber,
          status: TokenStatus.AWAITING_ARRIVAL,
          type: TokenType.WALKIN,
          walkinName: name,
          walkinPhone: phone,
          walkinAddress: address,
          idempotencyKey: crypto.randomUUID(),
        },
      });

      // Invalidate Cache
      await redis.del(`queue:${lockedQueue.id}`).catch(() => {});

      return {
        tokenId: token.id,
        tokenNumber: token.tokenNumber,
        queueId: lockedQueue.id,
        patientId: token.patientId,
      };
    });

    // 3. Side effects: Audit Log
    createAuditLog({
      userId: operatorId,
      role: Role.DOCTOR,
      action: AuditAction.CREATE,
      entityType: "QueueToken",
      entityId: result.tokenId,
      newValue: { type: TokenType.WALKIN, tokenNumber: result.tokenNumber, walkinPhone: phone },
    });

    if (result.patientId) {
      sendNotification(
        result.patientId,
        `You have been registered as a walk-in at Dr. ${doctor.name}'s clinic. Token Number: #${result.tokenNumber}.`,
        "IN_APP"
      ).catch(() => {});
    }

    return result;
  }
}

export const queueService = new QueueService();
