import { NextRequest } from "next/server";
import { joinWaitlistSchema } from "@/lib/schemas/booking.schema";
import { bookingService } from "@/lib/services/booking.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/utils/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PATIENT") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;
    const body = await request.json();

    // 1. Validate Input
    const result = joinWaitlistSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid input provided.", 400);
    }
    const { doctorId, phone, name } = result.data;

    // 2. Call booking service to join waitlist
    const waitlist = await bookingService.joinWaitlist(doctorId, phone, name, userId);

    return apiSuccess({
      message: "Successfully joined waitlist",
      waitlist: {
        id: waitlist.id,
        doctorId: waitlist.doctorId,
        phone: waitlist.phone,
        name: waitlist.name,
      },
    });
  } catch (error: any) {
    if (error.message === "PATIENT_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    console.error("join waitlist error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
