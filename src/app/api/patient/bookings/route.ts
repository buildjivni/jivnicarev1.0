import { NextRequest } from "next/server";
import { bookingService } from "@/lib/services/booking.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PATIENT") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const bookings = await bookingService.getBookings(userId);

    return apiSuccess({ bookings });
  } catch (error) {
    console.error("patient bookings fetch error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
