import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  turnstileToken: z.string().min(1, "Turnstile verification is required"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  isDoctor: z.boolean().optional(),
});
