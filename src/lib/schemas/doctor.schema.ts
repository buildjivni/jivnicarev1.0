import { z } from "zod";

export const doctorRegisterStep1Schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  speciality: z.string().min(1, "Speciality is required"),
});

export const doctorRegisterStep2Schema = z.object({
  clinicName: z.string().min(2, "Clinic name must be at least 2 characters"),
  clinicAddress: z.string().min(5, "Full clinic address is required"),
  clinicCity: z.string().min(2, "City is required"),
  clinicDistrict: z.enum(["Jamui", "Deoghar"], {
    errorMap: () => ({ message: "Service is restricted to Jamui and Deoghar districts only" }),
  }),
  clinicPincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  operatorName: z.string().min(2, "Operator name is required"),
  operatorMobile: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  receptionist1Name: z.string().optional(),
  receptionist1Phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid format").optional().or(z.literal("")),
});

export const doctorRegisterStep3Schema = z.object({
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  registrationNumber: z.string().min(1, "NMC Medical Registration Number is required"),
  qualifications: z.array(z.string()).min(1, "At least one qualification is required"),
  experienceYears: z.number().min(0).max(60),
  bio: z.string().max(500).optional(),
  languages: z.array(z.string()).default(["Hindi"]),
  profilePhoto: z.string().url("Invalid profile photo URL").optional(),
  clinicPhotos: z.array(z.string().url()).max(3, "Max 3 clinic photos allowed"),
  documents: z.array(z.string().url()).min(1, "Upload registration credentials").max(10),
  isEmergencyEnabled: z.boolean().default(false),
  emergencyCapacity: z.number().min(0).default(0),
  expertiseTags: z.array(z.string()).optional(),
  diseases: z.array(z.string()).optional(),
  procedures: z.array(z.string()).optional(),
});

export const doctorRegisterStep4Schema = z.object({
  weeklySchedule: z.record(z.object({
    isActive: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
  })),
  bookingWindowStart: z.string(),
  bookingWindowEnd: z.string(),
  dailyTokenLimit: z.number().min(1).max(100),
  consultationFee: z.number().min(0).max(2000),
});

export const doctorProfileUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  profilePhoto: z.string().url("Invalid profile photo URL").optional().or(z.literal("")),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().min(0, "Fee cannot be negative").max(2000, "Fee cannot exceed 2000").optional(),
  dailyTokenLimit: z.number().min(1, "Daily limit must be at least 1").max(100, "Daily limit cannot exceed 100").optional(),
  clinicName: z.string().min(2, "Clinic name must be at least 2 characters").optional(),
  clinicAddress: z.string().min(5, "Clinic address must be at least 5 characters").optional(),
  clinicPincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits").optional(),
  operatorName: z.string().min(2, "Operator name is required").optional(),
  operatorMobile: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format").optional(),
  receptionist1Name: z.string().optional(),
  receptionist1Phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid format").optional().or(z.literal("")),
  receptionist2Name: z.string().optional(),
  receptionist2Phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid format").optional().or(z.literal("")),
  receptionist3Name: z.string().optional(),
  receptionist3Phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid format").optional().or(z.literal("")),
  weeklySchedule: z.record(z.object({
    isActive: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
});

export const doctorStatusUpdateSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_BREAK", "OFFLINE"], {
    errorMap: () => ({ message: "Invalid availability status." }),
  }),
  breakMessage: z.string().max(200, "Break message cannot exceed 200 characters").optional().nullable(),
});

export const advanceQueueSchema = z.object({
  queueId: z.string().uuid("Invalid queue identifier"),
  action: z.enum(["CALL_NEXT", "COMPLETE"], {
    errorMap: () => ({ message: "Invalid action. Must be CALL_NEXT or COMPLETE." }),
  }),
});

export const transitionTokenSchema = z.object({
  fromStatus: z.enum([
    "BOOKED",
    "AWAITING_ARRIVAL",
    "PAYMENT_PENDING",
    "READY",
    "CALLED",
    "IN_CONSULTATION",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
    "EXPIRED"
  ], {
    errorMap: () => ({ message: "Invalid fromStatus value." }),
  }).optional(),
  toStatus: z.enum([
    "BOOKED",
    "AWAITING_ARRIVAL",
    "PAYMENT_PENDING",
    "READY",
    "CALLED",
    "IN_CONSULTATION",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
    "EXPIRED"
  ], {
    errorMap: () => ({ message: "Invalid toStatus value." }),
  }).optional(),
  internalNotes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
});

