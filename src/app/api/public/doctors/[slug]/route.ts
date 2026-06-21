import { NextRequest } from "next/server";
import { doctorService } from "@/lib/services/doctor.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const doctor = await doctorService.getDoctorBySlug(slug);

    if (!doctor) {
      return apiError(ERRORS.NOT_FOUND, 404);
    }

    return apiSuccess({ doctor });
  } catch (error) {
    console.error("public doctor profile fetch error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
