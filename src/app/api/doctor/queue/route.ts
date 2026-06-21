import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { queueService } from "@/lib/services/queue.service";
import { getSession } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const { queues, logicalDate } = await queueService.getDoctorQueuesByUserId(userId);
    return apiSuccess({ queues, logicalDate });
  } catch (error: any) {
    console.error("Fetch doctor queues error:", error);
    if (error.message === "Doctor profile not found.") {
      return apiError("Doctor profile not found.", 404);
    }
    if (error.message === "DOCTOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
