import { NextRequest } from "next/server";
import { bookAppointmentSchema } from "@/lib/schemas/booking.schema";
import { bookingService } from "@/lib/services/booking.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { TokenType } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user ID from headers (injected by middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const body = await request.json();

    // 2. Validate request body
    const result = bookAppointmentSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid input provided.", 400);
    }
    const { doctorId, date, type, idempotencyKey } = result.data;

    // 3. Call booking service
    const booking = await bookingService.book(
      doctorId,
      new Date(date),
      type as TokenType,
      idempotencyKey,
      userId
    );

    return apiSuccess(booking);
  } catch (error: any) {
    console.error("patient book endpoint error:", error);
    Sentry.captureException(error);

    // Map specific service exceptions to standard error responses
    if (error.message === "PATIENT_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    if (error.message === "BOOKING_LIMIT_EXCEEDED") {
      return apiError(ERRORS.BOOKING_LIMIT, 400);
    }
    if (error.message === "QUEUE_CLOSED") {
      return apiError("This queue is closed for bookings.", 400);
    }
    if (error.message === "QUEUE_FULL") {
      return apiError(ERRORS.QUEUE_FULL, 400);
    }

    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
