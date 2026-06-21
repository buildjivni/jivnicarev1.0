import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { generatePhoneHash } from "@/lib/services/crypto.service";
import { createAuditLog } from "@/lib/services/audit.service";
import { sendNotification } from "@/lib/services/notification.service";
import { TokenStatus, QueueStatus, QueueType, TokenType, AuditAction, Role, AvailabilityStatus } from "@prisma/client";
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
  async transition(
    tokenId: string,
    fromStatus: TokenStatus | undefined,
    toStatus: TokenStatus | undefined,
    operatorId?: string,
    internalNotes?: string | null
  ) {
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

    const isStatusUpdate = fromStatus && toStatus;

    if (isStatusUpdate) {
      const allowed = VALID_TRANSITIONS[fromStatus] || [];
      if (!allowed.includes(toStatus)) {
        throw new Error(`Illegal state transition from ${fromStatus} to ${toStatus}`);
      }
    }

    const updatedToken = await prisma.$transaction(async (tx) => {
      // 1. Exclusively lock the queueToken row
      await tx.$queryRaw`SELECT id FROM "queue_tokens" WHERE id = ${tokenId} FOR UPDATE`;

      // 2. Fetch fresh token state after lock is acquired
      const lockedToken = await tx.queueToken.findUnique({
        where: { id: tokenId },
      });

      if (!lockedToken) {
        throw new Error("Token not found.");
      }

      const data: any = {};
      
      if (isStatusUpdate) {
        // 3. Validate status matches expected fromStatus
        if (lockedToken.status !== fromStatus) {
          throw new Error(`State conflict: expected ${fromStatus}, found ${lockedToken.status}`);
        }
        data.status = toStatus;
        if (toStatus === TokenStatus.CALLED) {
          data.calledAt = new Date();
        } else if (toStatus === TokenStatus.COMPLETED) {
          data.completedAt = new Date();
        } else if (toStatus === TokenStatus.CANCELLED) {
          data.cancelledAt = new Date();
        }
      }

      if (internalNotes !== undefined) {
        data.internalNotes = internalNotes;
      }

      const ut = await tx.queueToken.update({
        where: { id: tokenId },
        data,
      });

      // Invalidate Cache
      await redis.del(`queue:${token.queueId}`).catch(() => {});

      // If cancelled/no-show, dispatch waitlist FIFO
      if (isStatusUpdate && (toStatus === TokenStatus.CANCELLED || toStatus === TokenStatus.NO_SHOW)) {
        const { bookingService } = await import("./booking.service");
        await bookingService.dispatchWaitlist(token.queue.doctorId, token.queue.date, tx);
      }

      return ut;
    });

    // Logging & Notifications
    if (isStatusUpdate) {
      createAuditLog({
        userId: operatorId || token.patientId || undefined,
        role: operatorId ? Role.DOCTOR : Role.PATIENT,
        action: AuditAction.UPDATE,
        entityType: "QueueToken",
        entityId: tokenId,
        oldValue: { status: fromStatus },
        newValue: { status: toStatus },
      });
    } else if (internalNotes !== undefined) {
      createAuditLog({
        userId: operatorId || token.patientId || undefined,
        role: operatorId ? Role.DOCTOR : Role.PATIENT,
        action: AuditAction.UPDATE,
        entityType: "QueueToken",
        entityId: tokenId,
        oldValue: { internalNotes: token.internalNotes },
        newValue: { internalNotes: internalNotes },
      });
    }

    if (token.patientId && isStatusUpdate && toStatus) {
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
      // Exclusively lock the dailyQueue row to serialize concurrent advances
      await tx.$queryRaw`SELECT id FROM "daily_queues" WHERE id = ${queueId} FOR UPDATE`;

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
      let calledToken = activeTokens.find((t) => t.status === TokenStatus.CALLED);
      const nextReadyToken = activeTokens.find((t) => t.status === TokenStatus.READY);

      let skippedTokenNumber: number | null = null;

      if (action === "CALL_NEXT") {
        // Auto-skip currently-CALLED token if it is older than 10 minutes (600,000 ms)
        if (calledToken) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          if (calledToken.calledAt && calledToken.calledAt < tenMinutesAgo) {
            skippedTokenNumber = calledToken.tokenNumber;
            await tx.queueToken.update({
              where: { id: calledToken.id },
              data: { status: TokenStatus.NO_SHOW },
            });
            createAuditLog({
              userId: operatorId,
              role: Role.DOCTOR,
              action: AuditAction.UPDATE,
              entityType: "QueueToken",
              entityId: calledToken.id,
              oldValue: { status: TokenStatus.CALLED },
              newValue: { status: TokenStatus.NO_SHOW },
            });

            // Dispatch waitlist FIFO since a slot opened
            const { bookingService } = await import("./booking.service");
            await bookingService.dispatchWaitlist(queue.doctorId, queue.date, tx);

            calledToken = undefined;
          }
        }

        // 1. auto-complete current IN_CONSULTATION
        if (inConsultationToken) {
          await tx.queueToken.update({
            where: { id: inConsultationToken.id },
            data: { status: TokenStatus.COMPLETED, completedAt: new Date() },
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
            data: { status: TokenStatus.CALLED, calledAt: new Date() },
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
            data: { status: TokenStatus.COMPLETED, completedAt: new Date() },
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
            data: { status: TokenStatus.CALLED, calledAt: new Date() },
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

      return { success: true, skippedTokenNumber };
    }, { timeout: 20000 });
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
    type: QueueType = QueueType.REGULAR,
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
            type,
          },
        },
      });

      if (!dailyQueue) {
        dailyQueue = await tx.dailyQueue.create({
          data: {
            doctorId,
            date: logicalDate,
            type,
            dailyLimit: type === QueueType.EMERGENCY ? 999 : doctor.dailyTokenLimit,
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

      // Count total tokens created today in this queue
      const totalToday = await tx.queueToken.count({
        where: { queueId: lockedQueue.id },
      });
      if (totalToday >= lockedQueue.dailyLimit * 2) {
        throw new Error("Walk-in capacity exceeded for today");
      }

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

  /**
   * Fetches today's queues for a doctor by user ID, checking user bans
   */
  async getDoctorQueuesByUserId(userId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!doctor) {
      throw new Error("Doctor profile not found.");
    }

    if (doctor.user.isBanned || !doctor.user.isActive) {
      throw new Error("DOCTOR_SUSPENDED");
    }

    const logicalDate = getLogicalDate();

    const queues = await prisma.dailyQueue.findMany({
      where: {
        doctorId: doctor.id,
        date: logicalDate,
      },
      include: {
        tokens: {
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
      },
    });

    return { queues, logicalDate };
  }

  /**
   * Verifies doctor profile and daily queue ownership before triggering advance()
   */
  async advanceQueueForDoctor(userId: string, queueId: string, action: "CALL_NEXT" | "COMPLETE") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });

    if (!doctor) {
      throw new Error("Doctor profile not found.");
    }

    const queue = await prisma.dailyQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new Error("Queue not found.");
    }

    if (queue.doctorId !== doctor.id) {
      throw new Error("FORBIDDEN");
    }

    return this.advance(queueId, action, userId);
  }

  /**
   * Resolves doctor profile and triggers walk-in token registration
   */
  async createWalkinForDoctorUser(
    userId: string,
    name: string,
    phone: string,
    address: string,
    type: QueueType = QueueType.REGULAR
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });

    if (!doctor) {
      throw new Error("Doctor profile not found.");
    }

    return this.createWalkin(doctor.id, new Date(), name, phone, address, type, userId);
  }

  /**
   * Verifies doctor profile and token ownership before running transition()
   */
  async transitionTokenForDoctor(
    userId: string,
    tokenId: string,
    fromStatus: TokenStatus | undefined,
    toStatus: TokenStatus | undefined,
    internalNotes?: string | null
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });

    if (!doctor) {
      throw new Error("Doctor profile not found.");
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

    if (token.queue.doctorId !== doctor.id) {
      throw new Error("FORBIDDEN");
    }

    return this.transition(tokenId, fromStatus, toStatus, userId, internalNotes);
  }

  /**
   * Encapsulates the entire midnight cleanup cron transaction block
   */
  async executeMidnightCleanup() {
    const logicalDate = getLogicalDate();

    const result = await prisma.$transaction(async (tx) => {
      // a. Expire active tokens today and older
      const tokenUpdate = await tx.queueToken.updateMany({
        where: {
          status: {
            in: [
              TokenStatus.BOOKED,
              TokenStatus.AWAITING_ARRIVAL,
              TokenStatus.PAYMENT_PENDING,
              TokenStatus.READY,
              TokenStatus.CALLED,
              TokenStatus.IN_CONSULTATION,
            ],
          },
          queue: {
            date: {
              lte: logicalDate,
            },
          },
        },
        data: {
          status: TokenStatus.EXPIRED,
        },
      });

      // b. Close daily queues today and older
      const queueUpdate = await tx.dailyQueue.updateMany({
        where: {
          date: {
            lte: logicalDate,
          },
          status: QueueStatus.ACTIVE,
        },
        data: {
          status: QueueStatus.CLOSED,
        },
      });

      // c. Find all daily queues that were closed to invalidate their redis caches
      const closedQueues = await tx.dailyQueue.findMany({
        where: {
          date: {
            lte: logicalDate,
          },
        },
        select: {
          id: true,
        },
      });

      // d. Reset doctor availability to OFFLINE
      const doctorUpdate = await tx.doctor.updateMany({
        where: {
          deletedAt: null,
        },
        data: {
          availabilityStatus: AvailabilityStatus.OFFLINE,
          isAcceptingBookings: false,
          breakMessage: null,
        },
      });

      // e. Update stats: Increment patient counters for doctors who completed sessions today
      const completedTokensGrouped = await tx.queueToken.groupBy({
        by: ["queueId"],
        where: {
          status: TokenStatus.COMPLETED,
          queue: {
            date: logicalDate,
          },
        },
        _count: {
          id: true,
        },
      });

      let statsUpdatedCount = 0;
      for (const group of completedTokensGrouped) {
        const queue = await tx.dailyQueue.findUnique({
          where: { id: group.queueId },
          select: { doctorId: true },
        });

        if (queue) {
          await tx.doctor.update({
            where: { id: queue.doctorId },
            data: {
              jivnicarePatientsServed: {
                increment: group._count.id,
              },
              lifetimePatientsServed: {
                increment: group._count.id,
              },
            },
          });
          statsUpdatedCount += group._count.id;
        }
      }

      // f. Purge search logs older than 90 days
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const searchLogPurge = await tx.searchLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return {
        expiredTokens: tokenUpdate.count,
        closedQueues: queueUpdate.count,
        closedQueueIds: closedQueues.map((q) => q.id),
        resetDoctors: doctorUpdate.count,
        statsUpdatedCount,
        purgedSearchLogs: searchLogPurge.count,
      };
    });

    for (const queueId of result.closedQueueIds) {
      await redis.del(`queue:${queueId}`).catch((err) => {
        console.error(`Redis del failed for queue:${queueId}`, err);
      });
    }

    return result;
  }
}

export const queueService = new QueueService();
