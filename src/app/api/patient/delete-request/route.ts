import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { requestUserDataDeletion } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate server-side via cookie
    const session = await getSession();
    if (!session) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const ip = request.ip || request.headers.get("x-forwarded-for") || "anonymous";

    // 2. Delegate database logging and email dispatching to the Service Layer
    const result = await requestUserDataDeletion(session.userId, ip);

    return apiSuccess(result);
  } catch (error: any) {
    if (error.message === "USER_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    if (error.message === "NOT_FOUND") {
      return apiError(ERRORS.NOT_FOUND, 404);
    }
    console.error("POST delete-request error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
