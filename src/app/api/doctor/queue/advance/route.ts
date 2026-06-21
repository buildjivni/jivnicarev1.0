import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { queueService } from "@/lib/services/queue.service";
import { getSession } from "@/lib/utils/auth";
import { advanceQueueSchema } from "@/lib/schemas/doctor.schema";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const body = await request.json();
    const result = advanceQueueSchema.safeParse(body);

    if (!result.success) {
      return apiError(result.error.errors[0]?.message || "Invalid input provided.", 400);
    }

    const { queueId, action } = result.data;

    const res = await queueService.advanceQueueForDoctor(userId, queueId, action);
    return apiSuccess(res);
  } catch (error: any) {
    console.error("Queue advance error:", error);
    if (error.message === "Doctor profile not found.") {
      return apiError("Doctor profile not found.", 404);
    }
    if (error.message === "Queue not found.") {
      return apiError("Queue not found.", 404);
    }
    if (error.message === "FORBIDDEN" || error.message === "OPERATOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
