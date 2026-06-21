import { NextRequest } from "next/server";
import { bookingService } from "@/lib/services/booking.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/utils/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;
    const role = session.role;
    const tokenId = params.id;

    const statusResult = await bookingService.getTokenStatus(tokenId, userId, role);
    return apiSuccess(statusResult);
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return apiError(ERRORS.NOT_FOUND, 404);
    }
    if (error.message === "FORBIDDEN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }
    console.error("token tracking error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}

// 4. DELETE handler to support patient cancellation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PATIENT") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const tokenId = params.id;

    const cancelledToken = await bookingService.cancel(tokenId, userId);
    return apiSuccess({
      message: "Booking cancelled successfully",
      token: {
        id: cancelledToken.id,
        status: cancelledToken.status,
      },
    });
  } catch (error: any) {
    console.error("token cancel error:", error);
    Sentry.captureException(error);
    
    if (error.message === "PATIENT_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    if (error.message === "INVALID_STATE") {
      return apiError(ERRORS.INVALID_STATE, 400);
    }
    if (error.message === "Access denied.") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }

    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
