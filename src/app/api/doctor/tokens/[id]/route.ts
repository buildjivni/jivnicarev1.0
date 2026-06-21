import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { queueService } from "@/lib/services/queue.service";
import { TokenStatus } from "@prisma/client";
import { getSession } from "@/lib/utils/auth";
import { transitionTokenSchema } from "@/lib/schemas/doctor.schema";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "DOCTOR") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const tokenId = params.id;
    const body = await request.json();
    const result = transitionTokenSchema.safeParse(body);

    if (!result.success) {
      return apiError(result.error.errors[0]?.message || "Invalid input provided.", 400);
    }

    const { fromStatus, toStatus, internalNotes } = result.data;

    const updatedToken = await queueService.transitionTokenForDoctor(
      userId,
      tokenId,
      fromStatus as TokenStatus | undefined,
      toStatus as TokenStatus | undefined,
      internalNotes
    );

    return apiSuccess({ token: updatedToken });
  } catch (error: any) {
    console.error("Token transition error:", error);
    if (error.message === "Doctor profile not found.") {
      return apiError("Doctor profile not found.", 404);
    }
    if (error.message === "Token not found.") {
      return apiError("Token not found.", 404);
    }
    if (error.message === "FORBIDDEN" || error.message === "OPERATOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
