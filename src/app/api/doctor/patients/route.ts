import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, ERRORS } from "@/lib/utils/api-response";
import { getSession } from "@/lib/utils/auth";
import { generatePhoneHash } from "@/lib/services/crypto.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "DOCTOR") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {
      queue: {
        doctorId: doctor.id,
      },
    };

    // Filter by date range
    if (fromStr || toStr) {
      whereClause.createdAt = {};
      if (fromStr) {
        whereClause.createdAt.gte = new Date(fromStr);
      }
      if (toStr) {
        const toDate = new Date(toStr);
        toDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = toDate;
      }
    }

    // Filter by search keyword
    if (search.trim()) {
      const isPhoneSearch = /^\+?[0-9]{10,12}$/.test(search.trim());
      if (isPhoneSearch) {
        const phoneHash = generatePhoneHash(search.trim());
        whereClause.OR = [
          { walkinPhone: { contains: search.trim() } },
          { patient: { phoneHash } },
        ];
      } else {
        whereClause.OR = [
          { walkinName: { contains: search, mode: "insensitive" } },
          { walkinAddress: { contains: search, mode: "insensitive" } },
          { patient: { name: { contains: search, mode: "insensitive" } } },
        ];
      }
    }

    const [tokens, total] = await Promise.all([
      prisma.queueToken.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.queueToken.count({ where: whereClause }),
    ]);

    return apiSuccess({
      patients: tokens.map((t) => {
        const name = t.type === "WALKIN" ? t.walkinName : t.patient?.name || "Online Patient";
        const phone = t.type === "WALKIN" ? t.walkinPhone : t.patient?.phone || "N/A";
        const address = t.type === "WALKIN" ? t.walkinAddress : "Online Booking";
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          status: t.status,
          type: t.type,
          name,
          phone,
          address,
          internalNotes: t.internalNotes,
          bookedAt: t.bookedAt,
          createdAt: t.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Fetch doctor patients history error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
