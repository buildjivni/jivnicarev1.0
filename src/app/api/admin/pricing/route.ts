import { NextRequest } from "next/server";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { adminService } from "@/lib/services/admin.service";
import { PartnerTier } from "@prisma/client";
import { getSession } from "@/lib/utils/auth";
import { adminPricingSchema } from "@/lib/schemas/admin.schema";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError(ERRORS.FORBIDDEN, 403);
    }

    const body = await request.json();
    const parsed = adminPricingSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const {
      doctorId,
      monthlyFee,
      perBookingFee,
      discountPercent,
      partnerTier,
      freeUntil,
    } = parsed.data;

    const updatedPricing = await adminService.configurePricing(doctorId, {
      monthlyFee,
      perBookingFee,
      discountPercent,
      partnerTier: partnerTier as PartnerTier,
      freeUntil: freeUntil ? new Date(freeUntil) : undefined,
    });

    return apiSuccess({ pricing: updatedPricing });
  } catch (error: any) {
    console.error("Configure pricing error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
