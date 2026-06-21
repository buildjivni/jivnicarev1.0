import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { generatePhoneHash, encrypt } from "@/lib/services/crypto.service";
import { createAuditLog } from "@/lib/services/audit.service";
import { sendNotification } from "@/lib/services/notification.service";
import { TokenType, TokenStatus, QueueType, QueueStatus, AuditAction, Role, AvailabilityStatus } from "@prisma/client";
import crypto from "crypto";

async function checkAndAutoTriggerAvailability(doctor: any, tx: any) {
  if (!doctor.clinicStartTime || !doctor.clinicEndTime) return doctor;

  const now = new Date();
  const options = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false } as const;
  const istTimeStr = now.toLocaleTimeString("en-US", options); // "09:30"
  
  const kolkataDateStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
  const kolkata4Am = new Date(`${kolkataDateStr} 04:00:00 GMT+0530`);
  
  if (
    doctor.availabilityStatus === "OFFLINE" &&
    doctor.updatedAt < kolkata4Am &&
    istTimeStr >= doctor.clinicStartTime &&
    istTimeStr < doctor.clinicEndTime
  ) {
    const updated = await tx.doctor.update({
      where: { id: doctor.id },
      data: {
        availabilityStatus: "AVAILABLE",
        isAcceptingBookings: true,
      },
    });
    const todayQueue = await tx.dailyQueue.findFirst({
      where: { doctorId: doctor.id, date: getLogicalDate() },
    });
    if (todayQueue) {
      await redis.del(`queue:${todayQueue.id}`).catch(() => {});
    }
    return { ...doctor, ...updated };
  }
  return doctor;
}

export class BookingService {
  /**
   * Atomic Booking Transaction
   */
  async book(
    doctorId: string,
    date: Date,
    type: TokenType,
    idempotencyKey: string,
    patientId: string // The logged-in patient's User ID
  ) {
    // 1. Resolve logical date
    const logicalDate = getLogicalDate(date);

    // 2. Perform everything in a single database transaction with a 20-second timeout
    const result = await prisma.$transaction(async (tx) => {
      // 2a. Acquire exclusive row lock on User to prevent concurrent booking limit bypasses
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${patientId} FOR UPDATE`;

      const user = await tx.user.findUnique({ where: { id: patientId } });
      if (!user) {
        throw new Error("User not found.");
      }
      if (user.isBanned || !user.isActive) {
        throw new Error("PATIENT_SUSPENDED");
      }

      // 2b. Validate Doctor exists, is verified & active, and handle auto-trigger of availability
      const doc = await tx.doctor.findFirst({
        where: {
          id: doctorId,
          verificationStatus: "VERIFIED",
          deletedAt: null,
        },
      });
      if (!doc) {
        throw new Error("Doctor not found or not active.");
      }
      const doctor = await checkAndAutoTriggerAvailability(doc, tx);

      // Enforce doctor availability: bookings only allowed if AVAILABLE
      if (doctor.availabilityStatus !== AvailabilityStatus.AVAILABLE || !doctor.isAcceptingBookings) {
        throw new Error("DOCTOR_UNAVAILABLE");
      }

      // 2c. Idempotency Check (Duplicate prevention)
      const existingToken = await tx.queueToken.findUnique({
        where: { idempotencyKey },
        include: {
          queue: {
            include: {
              doctor: true,
            },
          },
        },
      });

      if (existingToken) {
        // Calculate patients ahead
        const patientsAhead = await tx.queueToken.count({
          where: {
            queueId: existingToken.queueId,
            tokenNumber: { lt: existingToken.tokenNumber },
            status: { in: [TokenStatus.BOOKED, TokenStatus.AWAITING_ARRIVAL, TokenStatus.PAYMENT_PENDING, TokenStatus.READY] },
          },
        });

        return {
          tokenId: existingToken.id,
          tokenNumber: existingToken.tokenNumber,
          status: existingToken.status,
          patientsAhead,
          isDuplicate: true,
          queueId: existingToken.queueId,
          doctorName: doctor.name,
        };
      }

      // 2d. Enforce Booking Limit: Max 3 active bookings per patient per day
      const activeBookingCount = await tx.queueToken.count({
        where: {
          patientId,
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
            date: logicalDate,
          },
        },
      });

      if (activeBookingCount >= 3) {
        throw new Error("BOOKING_LIMIT_EXCEEDED");
      }

      // 2e. Find or create the DailyQueue for the doctor on this logical date
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

      // 2f. Exclusively Lock the DailyQueue row
      await tx.$queryRaw`
        SELECT id FROM "daily_queues" WHERE id = ${dailyQueue.id} FOR UPDATE
      `;

      // 2g. Fetch fresh DailyQueue state
      const lockedQueue = await tx.dailyQueue.findUnique({
        where: { id: dailyQueue.id },
      });

      if (!lockedQueue) {
        throw new Error("Queue not found.");
      }

      if (lockedQueue.status === QueueStatus.CLOSED) {
        throw new Error("QUEUE_CLOSED");
      }

      // 2h. Check Capacity Limit (blocks when totalTokens >= dailyTokenLimit)
      if (lockedQueue.totalTokens >= lockedQueue.dailyLimit) {
        throw new Error("QUEUE_FULL");
      }

      // 2i. Increment token count
      const newTokenNumber = lockedQueue.totalTokens + 1;
      await tx.dailyQueue.update({
        where: { id: lockedQueue.id },
        data: {
          totalTokens: newTokenNumber,
        },
      });

      // 2j. Create the QueueToken
      const token = await tx.queueToken.create({
        data: {
          queueId: lockedQueue.id,
          patientId,
          tokenNumber: newTokenNumber,
          status: TokenStatus.BOOKED,
          type,
          idempotencyKey,
        },
      });

      return {
        tokenId: token.id,
        tokenNumber: token.tokenNumber,
        status: token.status,
        queueId: lockedQueue.id,
        isDuplicate: false,
        doctorName: doctor.name,
      };
    }, { timeout: 20000 });

    // 3. Side effects outside transaction: Invalidate cache, Audit log, Notification
    const cacheKey = `queue:${result.queueId}`;
    await redis.del(cacheKey).catch(() => {});

    if (result.isDuplicate) {
      return {
        tokenId: result.tokenId,
        tokenNumber: result.tokenNumber,
        status: result.status,
        patientsAhead: result.patientsAhead,
        isDuplicate: true,
      };
    }

    createAuditLog({
      userId: patientId,
      role: Role.PATIENT,
      action: AuditAction.CREATE,
      entityType: "QueueToken",
      entityId: result.tokenId,
      newValue: { tokenNumber: result.tokenNumber, queueId: result.queueId },
    });

    sendNotification(
      patientId,
      `Your booking with Dr. ${result.doctorName} is confirmed. Token Number: #${result.tokenNumber}`,
      "IN_APP"
    ).catch(() => {});

    // Calculate patients ahead
    const patientsAhead = await prisma.queueToken.count({
      where: {
        queueId: result.queueId,
        tokenNumber: { lt: result.tokenNumber },
        status: { in: [TokenStatus.BOOKED, TokenStatus.AWAITING_ARRIVAL, TokenStatus.PAYMENT_PENDING, TokenStatus.READY] },
      },
    });

    return {
      tokenId: result.tokenId,
      tokenNumber: result.tokenNumber,
      status: result.status,
      patientsAhead,
      isDuplicate: false,
    };
  }

  /**
   * Cancel Booking (Patient Cancellation)
   */
  async cancel(tokenId: string, patientId?: string) {
    const token = await prisma.queueToken.findUnique({
      where: { id: tokenId },
      include: {
        patient: true,
        queue: {
          include: {
            doctor: true,
          },
        },
      },
    });

    if (!token) {
      throw new Error("Booking token not found.");
    }

    if (token.patient && (token.patient.isBanned || !token.patient.isActive)) {
      throw new Error("PATIENT_SUSPENDED");
    }

    if (patientId && token.patientId !== patientId) {
      throw new Error("Access denied.");
    }

    // Cancellations allowed only in Booked, Awaiting, Payment Pending, or Ready states
    const cancellableStates: TokenStatus[] = [
      TokenStatus.BOOKED,
      TokenStatus.AWAITING_ARRIVAL,
      TokenStatus.PAYMENT_PENDING,
      TokenStatus.READY,
    ];
    if (!cancellableStates.includes(token.status)) {
      throw new Error("INVALID_STATE");
    }

    const updatedToken = await prisma.$transaction(async (tx) => {
      // 1. Update Token status
      const ut = await tx.queueToken.update({
        where: { id: tokenId },
        data: {
          status: TokenStatus.CANCELLED,
        },
      });

      // 2. Invalidate cache
      await redis.del(`queue:${token.queueId}`).catch(() => {});

      // 3. FIFO Waitlist Dispatch: Trigger slot fulfillment
      await this.dispatchWaitlist(token.queue.doctorId, token.queue.date, tx);

      return ut;
    });

    // Side effects
    if (token.patientId) {
      createAuditLog({
        userId: token.patientId,
        role: Role.PATIENT,
        action: AuditAction.UPDATE,
        entityType: "QueueToken",
        entityId: tokenId,
        oldValue: { status: token.status },
        newValue: { status: TokenStatus.CANCELLED },
      });

      sendNotification(
        token.patientId,
        `Your booking Token #${token.tokenNumber} with Dr. ${token.queue.doctor.name} has been cancelled successfully.`,
        "IN_APP"
      ).catch(() => {});
    }

    return updatedToken;
  }

  /**
   * Joins the Doctor's Waitlist
   */
  async joinWaitlist(doctorId: string, phone: string, name?: string, userId?: string) {
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && (user.isBanned || !user.isActive)) {
        throw new Error("PATIENT_SUSPENDED");
      }
    }

    // Check if waitlist record already exists
    const existing = await prisma.waitlist.findFirst({
      where: {
        doctorId,
        phone,
        notified: false,
      },
    });

    if (existing) {
      return existing;
    }

    const waitlist = await prisma.waitlist.create({
      data: {
        doctorId,
        phone,
        name,
        userId,
      },
    });

    if (userId) {
      createAuditLog({
        userId,
        role: Role.PATIENT,
        action: AuditAction.CREATE,
        entityType: "Waitlist",
        entityId: waitlist.id,
      });
    }

    return waitlist;
  }

  /**
   * Waitlist Dispatch (FIFO Auto-Book)
   * Must run inside an active Prisma transaction client
   */
  async dispatchWaitlist(doctorId: string, date: Date, tx: any) {
    // 1. Find if the DailyQueue has space now
    const dailyQueue = await tx.dailyQueue.findFirst({
      where: {
        doctorId,
        date,
        type: QueueType.REGULAR,
      },
    });

    if (!dailyQueue || dailyQueue.status === QueueStatus.CLOSED) return;

    // Lock the DailyQueue row to prevent race conditions on capacity and token numbers
    await tx.$queryRaw`
      SELECT id FROM "daily_queues" WHERE id = ${dailyQueue.id} FOR UPDATE
    `;

    // Fetch fresh DailyQueue state after lock is acquired
    const lockedQueue = await tx.dailyQueue.findUnique({
      where: { id: dailyQueue.id },
    });

    if (!lockedQueue || lockedQueue.status === QueueStatus.CLOSED) return;
    
    // Count active tokens to check if space is available
    const activeTokensCount = await tx.queueToken.count({
      where: {
        queueId: lockedQueue.id,
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
      },
    });

    if (activeTokensCount >= lockedQueue.dailyLimit) return;

    // 2. Find the oldest waitlist entry
    const oldestWaitlist = await tx.waitlist.findFirst({
      where: {
        doctorId,
        notified: false,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!oldestWaitlist) return;

    // 3. Mark waitlist entry as notified
    await tx.waitlist.update({
      where: { id: oldestWaitlist.id },
      data: {
        notified: true,
        notifiedAt: new Date(),
      },
    });

    // 4. Resolve patient user account
    const phoneHash = generatePhoneHash(oldestWaitlist.phone);
    let user = await tx.user.findUnique({ where: { phoneHash } });
    if (!user) {
      user = await tx.user.create({
        data: {
          phone: encrypt(oldestWaitlist.phone),
          phoneHash,
          name: oldestWaitlist.name,
          role: Role.PATIENT,
        },
      });
    }

    // 5. Check if user already reached daily limit of 3 (unlikely, but safe check)
    const activeBookingCount = await tx.queueToken.count({
      where: {
        patientId: user.id,
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
          id: lockedQueue.id,
        },
      },
    });

    if (activeBookingCount >= 3) return; // Skip if they already booked 3

    // 6. Increment queue count
    const newTokenNumber = lockedQueue.totalTokens + 1;
    await tx.dailyQueue.update({
      where: { id: lockedQueue.id },
      data: {
        totalTokens: newTokenNumber,
      },
    });

    // 7. Auto-book the slot
    await tx.queueToken.create({
      data: {
        queueId: lockedQueue.id,
        patientId: user.id,
        tokenNumber: newTokenNumber,
        status: TokenStatus.BOOKED,
        type: TokenType.ONLINE,
        idempotencyKey: crypto.randomUUID(), // System auto-generated
      },
    });

    // Invalidate queue cache
    await redis.del(`queue:${lockedQueue.id}`).catch(() => {});

    // Send dispatch notification
    const doctor = await tx.doctor.findUnique({ where: { id: doctorId } });
    sendNotification(
      user.id,
      `Good news — your slot with Dr. ${doctor?.name || "Doctor"} is confirmed today, Token #${newTokenNumber}. Cancel from the app if you can't make it.`,
      "IN_APP"
    ).catch(() => {});
  }

  /**
   * Fetches active and past bookings for a patient
   */
  async getBookings(patientId: string) {
    return prisma.queueToken.findMany({
      where: {
        patientId,
      },
      include: {
        queue: {
          select: {
            id: true,
            date: true,
            status: true,
            type: true,
            doctor: {
              select: {
                id: true,
                name: true,
                slug: true,
                speciality: true,
                clinicName: true,
                clinicAddress: true,
                clinicCity: true,
                clinicDistrict: true,
                profilePhoto: true,
                partnerTier: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Retrieves token tracking parameters, patients ahead, currently serving, and validates permissions
   */
  async getTokenStatus(tokenId: string, userId: string, role: string) {
    const token = await prisma.queueToken.findUnique({
      where: { id: tokenId },
      include: {
        queue: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                speciality: true,
                clinicName: true,
                clinicAddress: true,
                clinicCity: true,
                availabilityStatus: true,
                isAcceptingBookings: true,
              },
            },
          },
        },
      },
    });

    if (!token) {
      throw new Error("NOT_FOUND");
    }

    if (token.patientId !== userId && role !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const patientsAhead = await prisma.queueToken.count({
      where: {
        queueId: token.queueId,
        tokenNumber: { lt: token.tokenNumber },
        status: {
          in: [
            TokenStatus.BOOKED,
            TokenStatus.AWAITING_ARRIVAL,
            TokenStatus.PAYMENT_PENDING,
            TokenStatus.READY,
          ],
        },
      },
    });

    const servingToken = await prisma.queueToken.findFirst({
      where: {
        queueId: token.queueId,
        status: {
          in: [TokenStatus.IN_CONSULTATION, TokenStatus.CALLED],
        },
      },
      orderBy: {
        tokenNumber: "asc",
      },
    });

    const currentlyServing = servingToken ? servingToken.tokenNumber : 0;

    return {
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        status: token.status,
        type: token.type,
        createdAt: token.createdAt,
      },
      doctor: token.queue.doctor,
      queue: {
        date: token.queue.date,
        status: token.queue.status,
        type: token.queue.type,
      },
      patientsAhead,
      currentlyServing,
    };
  }
}

export const bookingService = new BookingService();
