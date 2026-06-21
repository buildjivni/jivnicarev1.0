import { NextRequest } from "next/server";
import { searchService } from "@/lib/services/search.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get("district") || "Jamui"; // default to Jamui

    // 1. Fetch featured doctors using search service
    const featuredDoctors = await searchService.getFeaturedDoctors(district);

    // 2. Fetch active specialities sorted by sortOrder
    const specialities = await searchService.getActiveSpecialities();

    // 3. Fetch active districts (V1 hard limit: Jamui & Deoghar)
    const districts = await searchService.getActiveDistricts();

    return apiSuccess({
      featuredDoctors,
      specialities,
      districts,
    });
  } catch (error) {
    console.error("public home error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
