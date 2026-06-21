import { z } from "zod";

export const bookAppointmentSchema = z.object({
  doctorId: z.string().uuid("Invalid doctor identifier"),
  date: z.string().datetime("Invalid ISO date format"),
  type: z.enum(["ONLINE", "WALKIN"]),
  idempotencyKey: z.string().uuid("Invalid idempotency key"),
});

export const joinWaitlistSchema = z.object({
  doctorId: z.string().uuid("Invalid doctor identifier"),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  name: z.string().min(1, "Name is required").optional(),
});

export const publicSearchSchema = z.object({
  q: z.string().max(100, "Search query must not exceed 100 characters.").default(""),
  district: z.string({ required_error: "District is required", invalid_type_error: "District is required" }).min(1, "District is required"),
  speciality: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  feeRange: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["Under 200", "200-500", "500+"]).optional()),
  gender: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  language: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  availableToday: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  emergencyOnly: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  lat: z.preprocess((val) => (val && val !== "" ? parseFloat(val as string) : undefined), z.number().optional()),
  lng: z.preprocess((val) => (val && val !== "" ? parseFloat(val as string) : undefined), z.number().optional()),
  page: z.preprocess((val) => (val && val !== "" ? parseInt(val as string, 10) : 1), z.number().int().min(1).default(1)),
});
