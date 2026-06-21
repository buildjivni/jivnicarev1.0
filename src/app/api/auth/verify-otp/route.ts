import { NextRequest } from "next/server";
import { verifyOtpSchema } from "@/lib/schemas/auth.schema";
import { verifyOTP } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate Input
    const result = verifyOtpSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid input provided.", 400);
    }
    const { phone, otp, isDoctor } = result.data;

    // 2. Verify OTP
    const ip = request.ip || request.headers.get("x-forwarded-for") || "anonymous";
    const verifyResult = await verifyOTP(phone, otp, ip, isDoctor);
    if (!verifyResult.success) {
      return apiError(verifyResult.message || ERRORS.INVALID_OTP, 400);
    }

    return apiSuccess({
      message: "Login successful",
      role: verifyResult.user?.role,
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
