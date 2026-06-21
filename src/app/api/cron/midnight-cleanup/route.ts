import { NextRequest } from "next/server";
import { queueService } from "@/lib/services/queue.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authorization Header
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    // 2. Execute midnight cleanup service
    const result = await queueService.executeMidnightCleanup();

    return apiSuccess({
      message: "Midnight cleanup cron completed successfully.",
      summary: {
        expiredTokens: result.expiredTokens,
        closedQueues: result.closedQueues,
        resetDoctors: result.resetDoctors,
        statsUpdatedCount: result.statsUpdatedCount,
        purgedSearchLogs: result.purgedSearchLogs,
      },
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    Sentry.captureException(error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
