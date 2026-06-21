import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { adminService } from "@/lib/services/admin.service";
import { getSession } from "@/lib/utils/auth";
import { adminVerifyDoctorSchema, adminRejectDoctorSchema } from "@/lib/schemas/admin.schema";

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
    const { action, note, reason } = body;

    if (action === "APPROVE") {
      const parsed = adminVerifyDoctorSchema.safeParse({ verificationNote: note });
      if (!parsed.success) {
        return apiError(parsed.error.errors[0].message, 400);
      }
      const doctor = await adminService.verifyDoctor(doctorId, adminId, note);
      return apiSuccess({ doctor });
    } else if (action === "REJECT") {
      const parsed = adminRejectDoctorSchema.safeParse({ rejectionReason: reason });
      if (!parsed.success) {
        return apiError(parsed.error.errors[0].message, 400);
      }
      const doctor = await adminService.rejectDoctor(doctorId, adminId, reason);
      return apiSuccess({ doctor });
    } else {
      return apiError("Invalid action. Must be APPROVE or REJECT.", 400);
    }
  } catch (error: any) {
    console.error("Doctor verification error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
