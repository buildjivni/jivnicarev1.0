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

    const { doctors, grouped } = await adminService.getDoctorsList();

    return apiSuccess({ doctors, grouped });
  } catch (error: any) {
    console.error("Fetch admin doctors error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }
    const adminId = session.userId;

    const body = await request.json();
    const { name, phone, speciality } = body;

    if (!name || !phone || !speciality) {
      return apiError("Name, phone and speciality are required.", 400);
    }

    const newDoctor = await adminService.onboardDoctor(adminId, { name, phone, speciality });

    return apiSuccess({ doctor: newDoctor });
  } catch (error: any) {
    console.error("Admin onboard doctor error:", error);
    if (error.message === "DOCTOR_ALREADY_EXISTS") {
      return apiError("A doctor profile already exists for this phone number.", 400);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
