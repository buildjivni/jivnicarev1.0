import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { adminService } from "@/lib/services/admin.service";
import { getSession } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }

    const { queues, logicalDate } = await adminService.getQueueHealth();

    return apiSuccess({ queues, logicalDate });
  } catch (error: any) {
    console.error("Fetch queue health error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
