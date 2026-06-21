import { adminService } from "@/lib/services/admin.service";
import { apiSuccess, apiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await adminService.checkHealth();
    return apiSuccess({
      status: "healthy",
      db: "connected",
      redis: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return apiError("Service unhealthy", 503);
  }
}
