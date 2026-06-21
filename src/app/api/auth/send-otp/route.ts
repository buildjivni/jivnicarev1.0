import { NextRequest } from "next/server";
import { sendOtpSchema } from "@/lib/schemas/auth.schema";
import { generateOTP, verifyIpRateLimit } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is missing in production!");
      Sentry.captureMessage("TURNSTILE_SECRET_KEY is missing in production", "error");
      return false; // Fail-closed in production
    }
    return true; // Fail-open in dev/test if not configured
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
    }
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verification request failed:", err);
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(err);
      return false; // Fail-closed in production
    }
    return true; // Fail-open in development
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 1. Validate Input
    const result = sendOtpSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid input provided.", 400);
    }
    const { phone, turnstileToken } = result.data;

    const ip = request.ip || request.headers.get("x-forwarded-for") || "anonymous";

    // 2. Turnstile Verification
    const turnstileValid = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileValid) {
      return apiError("Bot detection challenge failed. Please try again.", 400);
    }

    // 3. Per-IP Rate Limiting (Max 10 per hour) via Service
    const isIpAllowed = await verifyIpRateLimit(ip);
    if (!isIpAllowed) {
      return apiError(ERRORS.RATE_LIMITED, 429);
    }

    // 4. Generate and send OTP (handles per-phone rate limit and storage fallback)
    const otpResult = await generateOTP(phone);
    if (!otpResult.success) {
      const retryAfter = (otpResult as any).retryAfter || 900;
      return NextResponseErrorResponse(otpResult.message || "Failed to send OTP", 429, retryAfter);
    }

    return apiSuccess({
      message: "OTP sent successfully",
      resendCooldownSeconds: 25,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}

function NextResponseErrorResponse(message: string, status: number, retryAfter: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
      },
    }
  );
}
