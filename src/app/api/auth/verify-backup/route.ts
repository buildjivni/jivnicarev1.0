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

    const { code } = await request.json();
    if (!code || typeof code !== "string" || code.length !== 8) {
      return apiError("Backup code must be exactly 8 characters.", 400);
    }

    // 2. Call Service Layer
    await adminService.verifyBackupCode(session.userId, session.sessionId, code);

    return apiSuccess({
      message: "Backup code verification successful",
    });
  } catch (error: any) {
    console.error("verify-backup error:", error);
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
    if (error.message === "INVALID_BACKUP_CODE") {
      return apiError("Invalid or already used backup code.", 400);
    }
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
