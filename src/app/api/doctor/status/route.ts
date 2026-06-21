import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { doctorService } from "@/lib/services/doctor.service";
import { AvailabilityStatus } from "@prisma/client";
import { getSession } from "@/lib/utils/auth";
import { doctorStatusUpdateSchema } from "@/lib/schemas/doctor.schema";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "DOCTOR") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await doctorService.getProfileByUserId(userId);

    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    const body = await request.json();
    const result = doctorStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0]?.message || "Invalid input provided.", 400);
    }
    const { status, breakMessage } = result.data;

    const updatedDoctor = await doctorService.updateStatus(
      doctor.id,
      status as AvailabilityStatus,
      breakMessage || undefined
    );

    return apiSuccess({ doctor: updatedDoctor });
  } catch (error: any) {
    console.error("Update status error:", error);
    if (error.message === "DOCTOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
