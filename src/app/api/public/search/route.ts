import { NextRequest } from "next/server";
import { searchService } from "@/lib/services/search.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { rateLimits, applyRateLimit } from "@/lib/utils/rate-limit";
import { publicSearchSchema } from "@/lib/schemas/booking.schema";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Enforce Search Rate Limit (100/hr)
    const limitResponse = await applyRateLimit(request, rateLimits.search);
    if (limitResponse) return limitResponse;

    const { searchParams } = new URL(request.url);
    const paramsObj = {
      q: searchParams.get("q") || undefined,
      district: searchParams.get("district") || undefined,
      speciality: searchParams.get("speciality") || undefined,
      feeRange: searchParams.get("feeRange") || undefined,
      gender: searchParams.get("gender") || undefined,
      language: searchParams.get("language") || undefined,
      availableToday: searchParams.get("availableToday") || undefined,
      emergencyOnly: searchParams.get("emergencyOnly") || undefined,
      lat: searchParams.get("lat") || undefined,
      lng: searchParams.get("lng") || undefined,
      page: searchParams.get("page") || undefined,
    };

    const parsedResult = publicSearchSchema.safeParse(paramsObj);
    if (!parsedResult.success) {
      return apiError(parsedResult.error.errors[0].message, 400);
    }

    const {
      q,
      district,
      speciality,
      feeRange,
      gender,
      language,
      availableToday,
      emergencyOnly,
      lat,
      lng,
      page,
    } = parsedResult.data;

    // 3. Minimum query length check
    if (q.trim().length === 1) {
      return apiSuccess({
        results: [],
        totalCount: 0,
        message: "Type at least 2 characters",
      });
    }

    // 5. Execute search
    const searchResult = await searchService.search(
      q,
      {
        district,
        speciality,
        feeRange,
        gender,
        language,
        availableToday,
        emergencyOnly,
      },
      lat,
      lng,
      page
    );

    return apiSuccess(searchResult);
  } catch (error) {
    console.error("public search error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
