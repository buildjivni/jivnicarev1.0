import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { adminService } from "@/lib/services/admin.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify session
    const session = await getSession();
    if (!session || session.role !== "ADMIN_PENDING_MFA") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const { token } = await request.json();
    if (!token || typeof token !== "string" || token.length !== 6) {
      return apiError("Verification code must be exactly 6 digits.", 400);
    }

    // 2. Call Service Layer
    const result = await adminService.verifyTOTP(session.userId, session.sessionId, token);

    return apiSuccess({
      message: "Admin verification successful",
      backupCodes: result.backupCodes,
    });
  } catch (error: any) {
    console.error("verify-totp error:", error);
    Sentry.captureException(error);
    if (error.message === "FORBIDDEN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }
    if (error.message === "SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    if (error.message === "NOT_FOUND") {
      return apiError(ERRORS.NOT_FOUND, 404);
    }
    if (error.message === "TOTP_SECRET_UNCONFIGURED") {
      return apiError("TOTP secret key is unconfigured. Please restart setup.", 400);
    }
    if (error.message === "INVALID_CODE") {
      return apiError("Invalid verification code. Please try again.", 400);
    }
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
