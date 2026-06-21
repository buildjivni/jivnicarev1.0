import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { createAuditLog } from "@/lib/services/audit.service";
import { sendNotification } from "@/lib/services/notification.service";
import { AvailabilityStatus, TokenStatus, Role, AuditAction, VerificationStatus } from "@prisma/client";

async function generateUniqueSlug(name: string, speciality: string, city: string): Promise<string> {
  const base = `dr-${name}-${speciality}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  let slug = base;
  let counter = 1;
  while (true) {
    const existing = await prisma.doctor.findUnique({
      where: { slug },
    });
    if (!existing) {
      break;
    }
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
}

export class DoctorService {
  /**
   * multi-step registration (4 steps total)
   */
  async register(userId: string, step: number, payload: any) {
    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    if (!userRecord) {
      throw new Error("User not found.");
    }
    if (userRecord.isBanned || !userRecord.isActive) {
      throw new Error("DOCTOR_SUSPENDED");
    }

    let doctor = await prisma.doctor.findUnique({
      where: { userId },
    });

    if (!doctor) {
      if (step !== 1) {
        throw new Error("Doctor profile not found.");
      }

      // Step 1: Create doctor profile
      const result = await prisma.$queryRaw<[{id: string}]>`SELECT generate_doctor_id() as id`;
      const internalDoctorId = result[0].id;
      const slug = `temp-dr-${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      doctor = await prisma.doctor.create({
        data: {
          userId,
          internalDoctorId,
          slug,
          name: payload.name,
          phone: payload.phone,
          speciality: payload.speciality,
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

      createAuditLog({
        userId,
        role: Role.DOCTOR,
        action: AuditAction.CREATE,
        entityType: "Doctor",
        entityId: doctor.id,
        newValue: { step, fieldsUpdated: ["name", "phone", "speciality"] },
      });

      return doctor;
    }

    let updateData: any = {
      registrationStep: Math.max(doctor.registrationStep, step),
    };

    if (step === 1) {
      updateData.name = payload.name;
      updateData.phone = payload.phone;
      updateData.speciality = payload.speciality;
    } else if (step === 2) {
      // Step 2: Clinic & Location details
      updateData.clinicName = payload.clinicName;
      updateData.clinicAddress = payload.clinicAddress;
      updateData.clinicCity = payload.clinicCity;
      updateData.clinicDistrict = payload.clinicDistrict;
      updateData.clinicPincode = payload.clinicPincode || null;
      updateData.clinicLatitude = payload.clinicLatitude || null;
      updateData.clinicLongitude = payload.clinicLongitude || null;
      updateData.operatorName = payload.operatorName;
      updateData.operatorMobile = payload.operatorMobile;

      // Generate the slug now that name, speciality and city are all present
      const slug = await generateUniqueSlug(doctor.name, doctor.speciality, payload.clinicCity);
      updateData.slug = slug;
    } else if (step === 3) {
      // Step 3: Professional Info & Receptionist numbers
      updateData.gender = payload.gender;
      updateData.qualifications = payload.qualifications || [];
      updateData.experienceYears = parseInt(payload.experienceYears, 10) || 0;
      updateData.registrationNumber = payload.registrationNumber;
      updateData.expertiseTags = payload.expertiseTags || [];
      updateData.diseases = payload.diseases || [];
      updateData.procedures = payload.procedures || [];
      updateData.bio = payload.bio || null;
      updateData.languages = payload.languages || ["Hindi"];
      updateData.profilePhoto = payload.profilePhoto || null;
      updateData.clinicPhotos = payload.clinicPhotos || [];
      updateData.documents = payload.documents || [];
      updateData.isEmergencyEnabled = payload.isEmergencyEnabled || false;
      updateData.emergencyCapacity = parseInt(payload.emergencyCapacity, 10) || 0;

      updateData.receptionist1Name = payload.receptionist1Name || null;
      updateData.receptionist1Phone = payload.receptionist1Phone || null;
      updateData.receptionist2Name = payload.receptionist2Name || null;
      updateData.receptionist2Phone = payload.receptionist2Phone || null;
      updateData.receptionist3Name = payload.receptionist3Name || null;
      updateData.receptionist3Phone = payload.receptionist3Phone || null;
    } else if (step === 4) {
      // Step 4: Schedule, Pricing & Documents Upload
      updateData.weeklySchedule = payload.weeklySchedule || null;
      updateData.bookingWindowStart = payload.bookingWindowStart || null;
      updateData.bookingWindowEnd = payload.bookingWindowEnd || null;
      updateData.dailyTokenLimit = parseInt(payload.dailyTokenLimit, 10) || 30;
      updateData.consultationFee = parseInt(payload.consultationFee, 10) || 0;
      updateData.registrationComplete = true;
      updateData.verificationStatus = VerificationStatus.PENDING_REVIEW; // submit for admin review
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctor.id },
      data: updateData,
    });

    createAuditLog({
      userId: doctor.userId,
      role: Role.DOCTOR,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctor.id,
      newValue: { step, fieldsUpdated: Object.keys(updateData) },
    });

    return updatedDoctor;
  }

  /**
   * Fetches the complete profile of a doctor
   */
  async getProfile(doctorId: string) {
    return prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
      },
    });
  }

  /**
   * Updates Availability Status (AVAILABLE, ON_BREAK, OFFLINE)
   * Resets isAcceptingBookings and triggers patient notification if going offline.
   */
  async updateStatus(doctorId: string, status: AvailabilityStatus, breakMessage?: string) {
    const doctor = await prisma.doctor.findUnique({ 
      where: { id: doctorId },
      include: { user: true }
    });
    if (!doctor) throw new Error("Doctor not found.");
    if (doctor.user.isBanned || !doctor.user.isActive) {
      throw new Error("DOCTOR_SUSPENDED");
    }

    const updatedDoctor = await prisma.$transaction(async (tx) => {
      // 1. Update doctor status
      const doc = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          availabilityStatus: status,
          isAcceptingBookings: status === "AVAILABLE",
          breakMessage: status === "ON_BREAK" ? breakMessage : null,
        },
      });

      if (status === "AVAILABLE") {
        const { bookingService } = await import("./booking.service");
        await bookingService.dispatchWaitlist(doctorId, getLogicalDate(), tx);
      }

      // 2. If OFFLINE: Resets availability and notifies all active booked patients for today
      if (status === "OFFLINE") {
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

        for (const token of activeTokens) {
          if (token.patientId) {
            sendNotification(
              token.patientId,
              `Dr. ${doctor.name} is offline today. The queue is paused. You can cancel your token #${token.tokenNumber} or keep it if you wish to wait.`,
              "IN_APP"
            ).catch(() => {});
          }
        }
      }

      return doc;
    });

    // Invalidate queue cache for today
    const todayQueue = await prisma.dailyQueue.findFirst({
      where: {
        doctorId,
        date: getLogicalDate(),
      },
    });
    if (todayQueue) {
      await redis.del(`queue:${todayQueue.id}`).catch(() => {});
    }

    createAuditLog({
      userId: doctor.userId,
      role: Role.DOCTOR,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctorId,
      oldValue: { availabilityStatus: doctor.availabilityStatus },
      newValue: { availabilityStatus: status },
    });

    return updatedDoctor;
  }

  /**
   * Updates weekly schedule
   */
  async updateSchedule(doctorId: string, schedule: any) {
    const doctor = await prisma.doctor.findUnique({ 
      where: { id: doctorId },
      include: { user: true }
    });
    if (!doctor) throw new Error("Doctor not found.");
    if (doctor.user.isBanned || !doctor.user.isActive) {
      throw new Error("DOCTOR_SUSPENDED");
    }

    const doc = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        weeklySchedule: schedule,
      },
    });

    createAuditLog({
      userId: doc.userId,
      role: Role.DOCTOR,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctorId,
      newValue: { weeklySchedule: schedule },
    });

    return doc;
  }

  /**
   * Fetches verified doctor profile by slug
   */
  async getDoctorBySlug(slug: string) {
    return prisma.doctor.findFirst({
      where: {
        slug,
        verificationStatus: "VERIFIED",
        canShowOnPublic: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        speciality: true,
        clinicName: true,
        clinicAddress: true,
        clinicCity: true,
        clinicDistrict: true,
        clinicPhotos: true,
        consultationFee: true,
        availabilityStatus: true,
        isAcceptingBookings: true,
        partnerTier: true,
        profilePhoto: true,
        bio: true,
        gender: true,
        languages: true,
        isEmergencyEnabled: true,
        emergencyFee: true,
        qualifications: true,
        experienceYears: true,
        expertiseTags: true,
        weeklySchedule: true,
      },
    });
  }

  /**
   * Fetches doctor profile by userId
   */
  async getProfileByUserId(userId: string) {
    return prisma.doctor.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });
  }

  /**
   * Updates allowed doctor profile fields by userId
   */
  async updateProfileByUserId(userId: string, allowedUpdates: any) {
    const doctor = await prisma.doctor.findUnique({ 
      where: { userId },
      include: { user: true }
    });
    if (!doctor) {
      throw new Error("Doctor profile not found.");
    }
    if (doctor.user.isBanned || !doctor.user.isActive) {
      throw new Error("DOCTOR_SUSPENDED");
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctor.id },
      data: allowedUpdates,
    });

    createAuditLog({
      userId: doctor.userId,
      role: Role.DOCTOR,
      action: AuditAction.UPDATE,
      entityType: "Doctor",
      entityId: doctor.id,
      newValue: { fieldsUpdated: Object.keys(allowedUpdates) },
    });

    return updatedDoctor;
  }

  /**
   * Creates a DoctorRequest lead capture
   */
  async createDoctorRequest(payload: { name: string; phone: string; district: string; speciality: string }) {
    const districtRecord = await prisma.district.findFirst({
      where: {
        name: { equals: payload.district, mode: "insensitive" },
        isActive: true,
      },
    });

    if (!districtRecord) {
      throw new Error("INVALID_DISTRICT");
    }

    return prisma.doctorRequest.create({
      data: {
        name: payload.name,
        phone: payload.phone,
        district: payload.district,
        speciality: payload.speciality,
      },
    });
  }

  /**
   * Fetches the first doctor record (for developer mock login)
   */
  async getFirstDoctor() {
    return prisma.doctor.findFirst();
  }
}

export const doctorService = new DoctorService();
