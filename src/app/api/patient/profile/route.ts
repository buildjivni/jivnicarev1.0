import { NextRequest } from "next/server";
import { getSession } from "@/lib/utils/auth";
import { updateUserProfile } from "@/lib/services/auth.service";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
  email: z.string().email("Invalid email address").max(100).optional().or(z.literal("")),
});

export async function PUT(request: NextRequest) {
  try {
    // 1. Authenticate server-side via cookie
    const session = await getSession();
    if (!session) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }

    const body = await request.json();
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0]?.message || "Invalid input provided.", 400);
    }

    const { name, email } = result.data;
    const updateData = {
      name,
      email: email === "" ? null : email,
    };

    // 2. Delegate data access to the Service Layer
    const updatedUser = await updateUserProfile(session.userId, updateData);

    return apiSuccess({ user: updatedUser });
  } catch (error: any) {
    if (error.message === "PATIENT_SUSPENDED") {
      return apiError("Account suspended.", 403);
    }
    if (error.message === "EMAIL_IN_USE") {
      return apiError("This email is already in use by another account.", 400);
    }
    console.error("PUT profile error:", error);
    Sentry.captureException(error);
    return apiError(ERRORS.SERVER_ERROR, 500);
  }
}
