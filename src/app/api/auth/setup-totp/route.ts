import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { adminService } from "@/lib/services/admin.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // 1. Verify session is in PENDING_MFA state
    const session = await getSession();
    if (!session || session.role !== "ADMIN_PENDING_MFA") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const totpData = await adminService.setupTOTP(session.userId);

    return apiSuccess(totpData);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }
    if (error.message === "NOT_FOUND") {
      return apiError(ERRORS.NOT_FOUND, 404);
    }
    if (error.message === "MFA_ALREADY_CONFIGURED") {
      return apiError("MFA is already configured.", 400);
    }
    console.error("setup-totp error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
