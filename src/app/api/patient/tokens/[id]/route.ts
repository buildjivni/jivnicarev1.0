import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { TokenStatus } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const tokenId = params.id;

    // 1. Fetch token and queue details
    const token = await prisma.queueToken.findUnique({
      where: { id: tokenId },
      include: {
        queue: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                speciality: true,
                clinicName: true,
                clinicAddress: true,
                clinicCity: true,
                availabilityStatus: true,
                isAcceptingBookings: true,
              },
            },
          },
        },
      },
    });

    if (!token) {
      return apiError(ERRORS.NOT_FOUND, 404);
    }

    // Authorization: User can only track their own token (or if they are Admin)
    const role = request.headers.get("x-user-role");
    if (token.patientId !== userId && role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }

    // 2. Count active patients ahead in the queue
    const patientsAhead = await prisma.queueToken.count({
      where: {
        queueId: token.queueId,
        tokenNumber: { lt: token.tokenNumber },
        status: {
          in: [
            TokenStatus.BOOKED,
            TokenStatus.AWAITING_ARRIVAL,
            TokenStatus.PAYMENT_PENDING,
            TokenStatus.READY,
          ],
        },
      },
    });

    // 3. Find token currently being served
    const servingToken = await prisma.queueToken.findFirst({
      where: {
        queueId: token.queueId,
        status: {
          in: [TokenStatus.IN_CONSULTATION, TokenStatus.CALLED],
        },
      },
      orderBy: {
        tokenNumber: "asc",
      },
    });

    const currentlyServing = servingToken ? servingToken.tokenNumber : 0;

    return apiSuccess({
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        status: token.status,
        type: token.type,
        createdAt: token.createdAt,
      },
      doctor: token.queue.doctor,
      queue: {
        date: token.queue.date,
        status: token.queue.status,
      },
      patientsAhead,
      currentlyServing,
    });
  } catch (error) {
    console.error("token tracking error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}

// 4. DELETE handler to support patient cancellation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const tokenId = params.id;
    const { bookingService } = await import("@/lib/services/booking.service");

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
