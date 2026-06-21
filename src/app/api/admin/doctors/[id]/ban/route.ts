import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { adminService } from "@/lib/services/admin.service";
import { getSession } from "@/lib/utils/auth";
import { adminBanDoctorSchema } from "@/lib/schemas/admin.schema";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }
    const adminId = session.userId;

    const doctorId = params.id;
    const body = await _request.json();

    const parsed = adminBanDoctorSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const doctor = await adminService.banDoctor(doctorId, adminId, parsed.data.reason);
    return apiSuccess({ doctor });
  } catch (error: any) {
    console.error("Doctor ban error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
