import { NextRequest } from "next/server";
import { searchService } from "@/lib/services/search.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const districts = await searchService.getActiveDistricts();
    return apiSuccess({ districts });
  } catch (error) {
    console.error("public districts fetch error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
