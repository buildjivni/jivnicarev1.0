import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { logout } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export async function POST(_request: NextRequest) {
  try {
    const session = await getSession();
    if (session) {
      await logout(session.sessionId);
    }
    return apiSuccess({ message: "Logout successful" });
  } catch (error) {
    console.error("logout error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
