import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { queueService } from "@/lib/services/queue.service";
import { z } from "zod";
import { getSession } from "@/lib/utils/auth";

const walkinSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  type: z.enum(["REGULAR", "EMERGENCY"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const body = await request.json();
    const result = walkinSchema.safeParse(body);

    if (!result.success) {
      return apiError(result.error.errors[0].message, 400);
    }

    const { name, phone, address, type } = result.data;
    const token = await queueService.createWalkinForDoctorUser(
      userId,
      name,
      phone,
      address,
      type
    );

    return apiSuccess({ token });
  } catch (error: any) {
    console.error("Walkin registration error:", error);
    if (error.message === "Walk-in capacity exceeded for today") {
      return apiError("Walk-in capacity exceeded for today", 409);
    }
    if (error.message === "Doctor profile not found.") {
      return apiError("Doctor profile not found.", 404);
    }
    if (error.message === "OPERATOR_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
