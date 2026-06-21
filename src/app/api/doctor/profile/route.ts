import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { doctorService } from "@/lib/services/doctor.service";
import { getSession } from "@/lib/utils/auth";
import { doctorProfileUpdateSchema } from "@/lib/schemas/doctor.schema";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await doctorService.getProfileByUserId(userId);

    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    return apiSuccess({ doctor });
  } catch (error: any) {
    console.error("Fetch doctor profile error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await doctorService.getProfileByUserId(userId);

    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    const body = await request.json();
    const result = doctorProfileUpdateSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0]?.message || "Invalid input provided.", 400);
    }
    const validatedData = result.data;

    if (validatedData.weeklySchedule !== undefined) {
      const updatedDoctor = await doctorService.updateSchedule(doctor.id, validatedData.weeklySchedule);
      return apiSuccess({ doctor: updatedDoctor });
    }

    // Support updating other basic fields
    const allowedUpdates: Record<string, any> = {};
    const updatableKeys = [
      "name",
      "phone",
      "email",
      "gender",
      "profilePhoto",
      "bio",
      "languages",
      "consultationFee",
      "dailyTokenLimit",
      "clinicName",
      "clinicAddress",
      "clinicPincode",
      "operatorName",
      "operatorMobile",
      "receptionist1Name",
      "receptionist1Phone",
      "receptionist2Name",
      "receptionist2Phone",
      "receptionist3Name",
      "receptionist3Phone",
    ];

    for (const key of updatableKeys) {
      const val = validatedData[key as keyof typeof validatedData];
      if (val !== undefined) {
        allowedUpdates[key] = val;
      }
    }

    if (Object.keys(allowedUpdates).length > 0) {
      const updatedDoctor = await doctorService.updateProfileByUserId(userId, allowedUpdates);
      return apiSuccess({ doctor: updatedDoctor });
    }

    return apiError("No valid fields to update.", 400);
  } catch (error: any) {
    console.error("Update doctor profile error:", error);
    if (error.message === "DOCTOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
