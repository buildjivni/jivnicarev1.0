import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { getUserProfile } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const userProfile = await getUserProfile(session.userId);

    return apiSuccess({
      user: userProfile,
    });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return apiError(ERRORS.NOT_FOUND, 404);
    }
    if (error.message === "SUSPENDED") {
      return apiError("Account suspended or inactive.", 403);
    }
    console.error("me error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
