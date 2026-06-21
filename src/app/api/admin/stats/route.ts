import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { adminService } from "@/lib/services/admin.service";
import { getLogicalDate } from "@/lib/utils/logical-date";
import { getSession } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }

    const logicalDate = getLogicalDate();
    const stats = await adminService.getSystemStats();

    return apiSuccess({
      ...stats,
      logicalDate,
    });
  } catch (error: any) {
    console.error("Fetch admin stats error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
