import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { createAuditLog } from "@/lib/services/audit.service";
import { sendNotification } from "@/lib/services/notification.service";
import { PartnerTier, VerificationStatus, AvailabilityStatus, TokenStatus, Role, AuditAction, QueueType } from "@prisma/client";

export class AdminService {
  /**
   * Verify Doctor Workflow
   */
  async verifyDoctor(doctorId: string, adminId: string, verificationNote: string) {
    if (!verificationNote || verificationNote.trim() === "") {
      throw new Error("Verification note is required.");
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) throw new Error("Doctor not found.");

    const updatedDoctor = await prisma.$transaction(async (tx) => {
      // 1. Update verification details
      const doc = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          canShowOnPublic: true,
          isAcceptingBookings: true,
          verifiedAt: new Date(),
          verifiedBy: adminId,
          verificationNote,
        },
      });

      // 2. Also ensure the linked user role is updated to DOCTOR
      await tx.user.update({
        where: { id: doctor.userId },
        data: { role: Role.DOCTOR },
      });

      return doc;
    });

    // Create Audit Log
    createAuditLog({
      userId: adminId,
      role: Role.ADMIN,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctorId,
      newValue: { verificationStatus: VerificationStatus.VERIFIED, verificationNote },
    });

    // Send email notification to doctor
    sendNotification(
      doctor.userId,
      "Congratulations! Your JivniCare doctor registration is approved and active.",
      "EMAIL"
    ).catch(() => {});

    return updatedDoctor;
  }

  /**
   * Reject Doctor Workflow
   */
  async rejectDoctor(doctorId: string, adminId: string, rejectionReason: string) {
    if (!rejectionReason || rejectionReason.trim() === "") {
      throw new Error("Rejection reason is required.");
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) throw new Error("Doctor not found.");

    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        canShowOnPublic: false,
        isAcceptingBookings: false,
        rejectionReason,
      },
    });

    // Create Audit Log
    createAuditLog({
      userId: adminId,
      role: Role.ADMIN,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctorId,
      newValue: { verificationStatus: VerificationStatus.REJECTED, rejectionReason },
    });

    // Send notification to doctor
    sendNotification(
      doctor.userId,
      `Your JivniCare registration request was declined. Reason: ${rejectionReason}`,
      "EMAIL"
    ).catch(() => {});

    return updatedDoctor;
  }

  /**
   * Ban Doctor Workflow (Strict Order)
   */
  async banDoctor(doctorId: string, adminId: string, reason: string) {
    if (!reason || reason.trim() === "") {
      throw new Error("Ban reason is required.");
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) throw new Error("Doctor not found.");

    const result = await prisma.$transaction(async (tx) => {
      // 1. doctor.verificationStatus = SUSPENDED
      // 2. doctor.canShowOnPublic = false
      // 3. doctor.isAcceptingBookings = false
      // 4. doctor.availabilityStatus = OFFLINE
      const doc = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          verificationStatus: VerificationStatus.SUSPENDED,
          canShowOnPublic: false,
          isAcceptingBookings: false,
          availabilityStatus: AvailabilityStatus.OFFLINE,
        },
      });

      // 5. Update user banned fields
      await tx.user.update({
        where: { id: doctor.userId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: reason,
        },
      });

      // 6. Delete all doctor auth_sessions (immediate session revocation)
      await tx.authSession.deleteMany({
        where: { userId: doctor.userId },
      });

      // 7. Find active patients booked in today's queue to notify them
      const logicalDate = getLogicalDate();
      const activeTokens = await tx.queueToken.findMany({
        where: {
          queue: {
            doctorId,
            date: logicalDate,
          },
          status: {
            in: [TokenStatus.BOOKED, TokenStatus.AWAITING_ARRIVAL, TokenStatus.PAYMENT_PENDING, TokenStatus.READY],
          },
        },
        select: {
          id: true,
          patientId: true,
          tokenNumber: true,
        },
      });

      return { doc, activeTokens };
    });

    // 8. Invalidate active queue caches
    const todayQueue = await prisma.dailyQueue.findFirst({
      where: {
        doctorId,
        date: getLogicalDate(),
      },
    });
    if (todayQueue) {
      await redis.del(`queue:${todayQueue.id}`).catch(() => {});
    }

    // 9. Log Audit action: BAN
    createAuditLog({
      userId: adminId,
      role: Role.ADMIN,
      action: AuditAction.BAN,
      entityType: "Doctor",
      entityId: doctorId,
      newValue: { reason },
    });

    // 10. Send notification to doctor
    sendNotification(
      doctor.userId,
      `Your Doctor account has been SUSPENDED by JivniCare. Reason: ${reason}`,
      "EMAIL"
    ).catch(() => {});

    // 11. Send notifications to patients in queue
    for (const token of result.activeTokens) {
      if (token.patientId) {
        sendNotification(
          token.patientId,
          `Appointment update: Dr. ${doctor.name} is unavailable today. You can choose to cancel your Token #${token.tokenNumber}.`,
          "IN_APP"
        ).catch(() => {});
      }
    }

    return result.doc;
  }

  /**
   * Configure platform pricing
   */
  async configurePricing(
    doctorId: string,
    pricing: {
      monthlyFee?: number;
      perBookingFee?: number;
      discountPercent?: number;
      partnerTier: PartnerTier;
      freeUntil?: Date;
    }
  ) {
    const updatedPricing = await prisma.$transaction(async (tx) => {
      // 1. Update doctor partnerTier
      await tx.doctor.update({
        where: { id: doctorId },
        data: {
          partnerTier: pricing.partnerTier,
        },
      });

      // 2. Upsert PlatformPricing details
      return tx.platformPricing.upsert({
        where: { doctorId },
        update: {
          monthlyFee: pricing.monthlyFee ?? 0,
          perBookingFee: pricing.perBookingFee ?? 0,
          discountPercent: pricing.discountPercent ?? 100, // default 100% discount for V1
          freeUntil: pricing.freeUntil || null,
        },
        create: {
          doctorId,
          monthlyFee: pricing.monthlyFee ?? 0,
          perBookingFee: pricing.perBookingFee ?? 0,
          discountPercent: pricing.discountPercent ?? 100,
          freeUntil: pricing.freeUntil || null,
        },
      });
    });

    // Log audit
    createAuditLog({
      action: AuditAction.UPDATE,
      entityType: "PlatformPricing",
      entityId: doctorId,
      newValue: pricing,
    });

    return updatedPricing;
  }

  /**
   * Health ping check for DB and Redis
   */
  async checkHealth() {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
  }

  async getQueueHealth() {
    const queues = await prisma.dailyQueue.findMany({
      where: {
        date: getLogicalDate(),
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            speciality: true,
            clinicName: true,
            internalDoctorId: true,
          },
        },
        tokens: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = queues.map((q) => {
      const activeCount = q.tokens.filter(
        (t) =>
          t.status === TokenStatus.BOOKED ||
          t.status === TokenStatus.AWAITING_ARRIVAL ||
          t.status === TokenStatus.PAYMENT_PENDING ||
          t.status === TokenStatus.READY ||
          t.status === TokenStatus.CALLED ||
          t.status === TokenStatus.IN_CONSULTATION
      ).length;

      const completedCount = q.tokens.filter((t) => t.status === TokenStatus.COMPLETED).length;
      const noShowCount = q.tokens.filter((t) => t.status === TokenStatus.NO_SHOW).length;

      return {
        id: q.id,
        doctorId: q.doctorId,
        doctorName: q.doctor.name,
        speciality: q.doctor.speciality,
        clinicName: q.doctor.clinicName,
        internalDoctorId: q.doctor.internalDoctorId,
        date: q.date,
        type: q.type,
        status: q.status,
        dailyLimit: q.dailyLimit,
        totalTokens: q.totalTokens,
        activeCount,
        completedCount,
        noShowCount,
      };
    });

    return { queues: formatted, logicalDate: getLogicalDate() };
  }

  /**
   * Search query analysis insights
   */
  async getSearchInsights() {
    const topQueriesRaw = await prisma.searchLog.groupBy({
      by: ["query"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 10,
    });

    const topQueries = topQueriesRaw.map((q) => ({
      query: q.query,
      count: q._count.id,
    }));

    const zeroResultQueriesRaw = await prisma.searchLog.groupBy({
      by: ["query"],
      where: {
        resultCount: 0,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 10,
    });

    const zeroResultQueries = zeroResultQueriesRaw.map((q) => ({
      query: q.query,
      count: q._count.id,
    }));

    return { topQueries, zeroResultQueries };
  }

  /**
   * System statistics counters
   */
  async getSystemStats() {
    const logicalDate = getLogicalDate();

    const onlineDoctors = await prisma.doctor.count({
      where: {
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        deletedAt: null,
      },
    });

    const queueCount = await prisma.dailyQueue.count({
      where: {
        date: logicalDate,
      },
    });

    const emergencyQueueCount = await prisma.dailyQueue.count({
      where: {
        date: logicalDate,
        type: QueueType.EMERGENCY,
      },
    });

    const bookingsCount = await prisma.queueToken.count({
      where: {
        queue: {
          date: logicalDate,
        },
      },
    });

    const pendingVerifications = await prisma.doctor.count({
      where: {
        verificationStatus: VerificationStatus.PENDING_REVIEW,
      },
    });

    return {
      onlineDoctors,
      queueCount,
      emergencyQueueCount,
      bookingsCount,
      pendingVerifications,
    };
  }

  /**
   * Admin Google Authenticator setup
   */
  async setupTOTP(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "ADMIN" || !user.email) {
      throw new Error("FORBIDDEN");
    }
    if (user.isBanned || !user.isActive) {
      throw new Error("SUSPENDED");
    }

    const admin = await prisma.admin.findUnique({ where: { email: user.email } });
    if (!admin) {
      throw new Error("NOT_FOUND");
    }

    if (admin.totpEnabled) {
      throw new Error("MFA_ALREADY_CONFIGURED");
    }

    const { generateTOTPSecret } = await import("@/lib/utils/totp");
    const { encrypt } = await import("@/lib/services/crypto.service");

    const secret = generateTOTPSecret();
    const encryptedSecret = encrypt(secret);

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        totpSecret: encryptedSecret,
      },
    });

    const label = `JivniCare:${admin.email}`;
    const qrCodeUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=JivniCare&algorithm=SHA1&digits=6&period=30`;

    return {
      secret,
      qrCodeUri,
      email: admin.email,
    };
  }

  /**
   * Validate TOTP code and upgrade session
   */
  async verifyTOTP(userId: string, sessionId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "ADMIN" || !user.email) {
      throw new Error("FORBIDDEN");
    }

    if (user.isBanned) {
      throw new Error("SUSPENDED");
    }

    const admin = await prisma.admin.findUnique({ where: { email: user.email } });
    if (!admin) {
      throw new Error("NOT_FOUND");
    }

    const { decrypt } = await import("@/lib/services/crypto.service");
    const decryptedSecret = decrypt(admin.totpSecret);
    if (!decryptedSecret) {
      throw new Error("TOTP_SECRET_UNCONFIGURED");
    }

    const { verifyAdminTOTP } = await import("@/lib/utils/totp");
    const isTokenValid = verifyAdminTOTP(token, decryptedSecret);
    if (!isTokenValid) {
      throw new Error("INVALID_CODE");
    }

    const isFirstTimeSetup = !admin.totpEnabled;
    let plainBackupCodes: string[] = [];
    const crypto = await import("crypto");

    if (isFirstTimeSetup) {
      const codes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString("hex")
      );
      plainBackupCodes = codes;

      await prisma.$transaction(async (tx) => {
        await tx.backupCode.deleteMany({ where: { adminId: admin.id } });
        await tx.backupCode.createMany({
          data: codes.map((c) => ({
            adminId: admin.id,
            codeHash: crypto.createHash("sha256").update(c).digest("hex"),
            used: false,
          })),
        });

        await tx.admin.update({
          where: { id: admin.id },
          data: {
            totpEnabled: true,
            lastLoginAt: new Date(),
          },
        });
      });
    } else {
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          lastLoginAt: new Date(),
        },
      });
    }

    const { createJWT, setSessionCookie } = await import("@/lib/utils/auth");
    const { enforceSessionLimit } = await import("@/lib/services/auth.service");

    await enforceSessionLimit(user.id, "ADMIN");
    await prisma.authSession.deleteMany({ where: { id: sessionId } });

    const newSession = await prisma.authSession.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const upgradedJwt = await createJWT({
      userId: user.id,
      role: "ADMIN",
      sessionId: newSession.id,
    });
    setSessionCookie(upgradedJwt);

    return {
      backupCodes: isFirstTimeSetup ? plainBackupCodes : undefined,
    };
  }

  /**
   * Validate backup code and upgrade session
   */
  async verifyBackupCode(userId: string, sessionId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "ADMIN" || !user.email) {
      throw new Error("FORBIDDEN");
    }

    if (user.isBanned) {
      throw new Error("SUSPENDED");
    }

    const admin = await prisma.admin.findUnique({ where: { email: user.email } });
    if (!admin) {
      throw new Error("NOT_FOUND");
    }

    const crypto = await import("crypto");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const backupCodeRecord = await prisma.backupCode.findFirst({
      where: {
        adminId: admin.id,
        codeHash,
        used: false,
      },
    });

    if (!backupCodeRecord) {
      throw new Error("INVALID_BACKUP_CODE");
    }

    await prisma.$transaction(async (tx) => {
      await tx.backupCode.update({
        where: { id: backupCodeRecord.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      await tx.admin.update({
        where: { id: admin.id },
        data: {
          lastLoginAt: new Date(),
        },
      });
    });

    const { createJWT, setSessionCookie } = await import("@/lib/utils/auth");
    const { enforceSessionLimit } = await import("@/lib/services/auth.service");

    await enforceSessionLimit(user.id, "ADMIN");
    await prisma.authSession.deleteMany({ where: { id: sessionId } });

    const newSession = await prisma.authSession.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const upgradedJwt = await createJWT({
      userId: user.id,
      role: "ADMIN",
      sessionId: newSession.id,
    });
    setSessionCookie(upgradedJwt);
  }

  /**
   * Fetches the complete list of doctor profiles
   */
  async getDoctorsList() {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const grouped = doctors.reduce((acc: any, doc) => {
      const status = doc.verificationStatus;
      if (!acc[status]) acc[status] = [];
      acc[status].push(doc);
      return acc;
    }, {});

    return { doctors, grouped };
  }

  /**
   * Onboards doctor from admin command center
   */
  async onboardDoctor(_adminId: string, payload: { name: string; phone: string; speciality: string }) {
    const { name, phone, speciality } = payload;
    const { generatePhoneHash, encrypt } = await import("@/lib/services/crypto.service");

    const phoneHash = generatePhoneHash(phone);

    let user = await prisma.user.findUnique({
      where: { phoneHash },
    });

    if (user) {
      const existingDoc = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (existingDoc) {
        throw new Error("DOCTOR_ALREADY_EXISTS");
      }
    }

    const newDoctor = await prisma.$transaction(async (tx) => {
      let createdOrUpdatedUser = user;
      if (!createdOrUpdatedUser) {
        createdOrUpdatedUser = await tx.user.create({
          data: {
            phone: encrypt(phone),
            phoneHash,
            role: Role.DOCTOR,
            authProvider: "PATIENT_OTP",
          },
        });
      } else {
        createdOrUpdatedUser = await tx.user.update({
          where: { id: user!.id },
          data: { role: Role.DOCTOR },
        });
      }

      const result = await tx.$queryRaw<[{id: string}]>`SELECT generate_doctor_id() as id`;
      const internalDoctorId = result[0].id;
      const slug = `dr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      const doctor = await tx.doctor.create({
        data: {
          userId: createdOrUpdatedUser.id,
          internalDoctorId,
          slug,
          name,
          phone,
          speciality,
          registrationNumber: "",
          clinicName: "",
          clinicAddress: "",
          clinicCity: "",
          clinicDistrict: "Jamui",
          operatorName: "",
          operatorMobile: "",
          registrationStep: 1,
          registrationComplete: false,
          verificationStatus: VerificationStatus.PENDING_ACTIVATION,
        },
      });

      return doctor;
    });

    return newDoctor;
  }
}

export const adminService = new AdminService();
