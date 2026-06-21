import { prisma } from "@/lib/prisma";
import { mapSymptomToSpeciality } from "@/lib/data/symptom-map";
import { AvailabilityStatus, PartnerTier, Gender } from "@prisma/client";

export interface SearchFilters {
  district: string;
  speciality?: string;
  feeRange?: string;
  gender?: string;
  language?: string;
  availableToday?: boolean;
  emergencyOnly?: boolean;
}

export interface ScoredDoctor {
  id: string;
  name: string;
  slug: string;
  speciality: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity: string;
  clinicDistrict: string;
  clinicPhotos: string[];
  consultationFee: number;
  availabilityStatus: AvailabilityStatus;
  isAcceptingBookings: boolean;
  partnerTier: PartnerTier;
  profilePhoto: string | null;
  bio: string | null;
  score: number;
  gender: Gender | null;
  languages: string[];
  isEmergencyEnabled: boolean;
  emergencyFee: number | null;
  lifetimePatientsServed: number;
}

// Haversine formula for calculating distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class SearchService {
  /**
   * 5-Layer Search Pipeline
   */
  async search(
    query: string,
    filters: SearchFilters,
    lat?: number,
    lng?: number,
    page = 1
  ): Promise<{ results: ScoredDoctor[]; totalCount: number }> {
    const pageSize = 20;
    
    // 1. Verify District exists and is active (V1 restriction: Jamui and Deoghar only)
    const districtRecord = await prisma.district.findFirst({
      where: {
        name: { equals: filters.district, mode: "insensitive" },
        isActive: true,
      },
    });

    if (!districtRecord) {
      return { results: [], totalCount: 0 };
    }

    // 2. Query Understanding (Layer 1)
    const mappedSpeciality = query.trim().length >= 2 ? mapSymptomToSpeciality(query) : null;

    // 3. PostgreSQL Query (Layer 2)
    // Build Prisma query to fetch candidates (Safety Cap: fetch max 500)
    const whereConditions: any = {
      clinicDistrict: { equals: filters.district, mode: "insensitive" },
      verificationStatus: "VERIFIED",
      canShowOnPublic: true,
      deletedAt: null,
    };

    // Apply query keywords search (Layer 2 - search up to 8 fields simultaneously)
    if (query.trim().length >= 2) {
      const orConditions: any[] = [
        { name: { contains: query, mode: "insensitive" } },
        { clinicName: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
        { speciality: { contains: query, mode: "insensitive" } },
        { clinicCity: { contains: query, mode: "insensitive" } },
        { diseases: { has: query } },
        { procedures: { has: query } },
        { internalDoctorId: { contains: query, mode: "insensitive" } },
      ];

      if (mappedSpeciality) {
        orConditions.push({ speciality: { equals: mappedSpeciality, mode: "insensitive" } });
      }

      whereConditions.OR = orConditions;
    }

    // Apply database hard filters (Layer 4)
    if (filters.speciality) {
      whereConditions.speciality = { equals: filters.speciality, mode: "insensitive" };
    }

    if (filters.gender && filters.gender !== "Any") {
      whereConditions.gender = filters.gender.toUpperCase();
    }

    if (filters.language) {
      whereConditions.languages = { has: filters.language };
    }

    if (filters.emergencyOnly) {
      whereConditions.isEmergencyEnabled = true;
    }

    if (filters.availableToday) {
      whereConditions.availabilityStatus = "AVAILABLE";
    }

    if (filters.feeRange) {
      if (filters.feeRange === "Under 200") {
        whereConditions.consultationFee = { lt: 200 };
      } else if (filters.feeRange === "200-500") {
        whereConditions.consultationFee = { gte: 200, lte: 500 };
      } else if (filters.feeRange === "500+") {
        whereConditions.consultationFee = { gt: 500 };
      }
    }

    // Fetch matching candidates from DB
    const candidates = await prisma.doctor.findMany({
      where: whereConditions,
      take: 500, // Safety cap
      select: {
        id: true,
        name: true,
        slug: true,
        speciality: true,
        clinicName: true,
        clinicAddress: true,
        clinicCity: true,
        clinicDistrict: true,
        clinicPhotos: true,
        consultationFee: true,
        availabilityStatus: true,
        isAcceptingBookings: true,
        partnerTier: true,
        profilePhoto: true,
        bio: true,
        gender: true,
        languages: true,
        isEmergencyEnabled: true,
        emergencyFee: true,
        clinicLatitude: true,
        clinicLongitude: true,
        diseases: true,
        procedures: true,
        lifetimePatientsServed: true,
      },
    });

    // 4. In-Memory Scoring Engine (Layer 3)
    const scoredCandidates: ScoredDoctor[] = candidates.map((doc) => {
      let score = 0;

      // 4a. Keyword Match (Max 40 points)
      let keywordScore = 0;
      if (query.trim().length >= 2) {
        const q = query.toLowerCase().trim();
        
        // Exact or mapped speciality match (40 pts)
        if (
          doc.speciality.toLowerCase().includes(q) ||
          (mappedSpeciality && doc.speciality.toLowerCase() === mappedSpeciality.toLowerCase())
        ) {
          keywordScore = Math.max(keywordScore, 40);
        }
        // Doctor Name match (35 pts)
        if (doc.name.toLowerCase().includes(q)) {
          keywordScore = Math.max(keywordScore, 35);
        }
        // Clinic Name match (25 pts)
        if (doc.clinicName.toLowerCase().includes(q)) {
          keywordScore = Math.max(keywordScore, 25);
        }
        // Diseases / Procedures match (20 pts)
        const hasDisease = doc.diseases.some((d) => d.toLowerCase().includes(q));
        const hasProcedure = doc.procedures.some((p) => p.toLowerCase().includes(q));
        if (hasDisease || hasProcedure) {
          keywordScore = Math.max(keywordScore, 20);
        }
        // Bio match (10 pts)
        if (doc.bio && doc.bio.toLowerCase().includes(q)) {
          keywordScore = Math.max(keywordScore, 10);
        }
      } else {
        // Default keyword score if empty query
        keywordScore = 40;
      }
      score += keywordScore;

      // 4b. Availability (Max 25 points)
      // isOnline = 15 pts | isAcceptingBookings = 10 pts
      const isOnline = doc.availabilityStatus === "AVAILABLE";
      if (isOnline) score += 15;
      if (doc.isAcceptingBookings) score += 10;

      // 4c. Distance (Max 20 points) Haversine Formula
      let distanceScore = 0;
      if (lat !== undefined && lng !== undefined && doc.clinicLatitude !== null && doc.clinicLongitude !== null) {
        const dist = calculateDistance(lat, lng, doc.clinicLatitude, doc.clinicLongitude);
        if (dist <= 2) distanceScore = 20;
        else if (dist <= 5) distanceScore = 15;
        else if (dist <= 10) distanceScore = 10;
        else if (dist <= 20) distanceScore = 5;
      }
      score += distanceScore;

      // 4d. Profile Completeness (Max 10 points)
      // Photo = 4 pts | Bio = 3 pts | Diseases = 3 pts
      let profileScore = 0;
      if (doc.profilePhoto) profileScore += 4;
      if (doc.bio && doc.bio.trim().length > 0) profileScore += 3;
      if (doc.diseases.length > 0) profileScore += 3;
      score += profileScore;

      // 4e. Early Partner Bonus (5 points)
      if (doc.partnerTier === "EARLY_PARTNER") {
        score += 5;
      }

      return {
        ...doc,
        score,
      };
    });

    // 5. Ranking and Sorting (Layer 5)
    scoredCandidates.sort((a, b) => {
      // Primary: Highest score first
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary: Online/Available status first
      const aOnline = a.availabilityStatus === "AVAILABLE" ? 1 : 0;
      const bOnline = b.availabilityStatus === "AVAILABLE" ? 1 : 0;
      if (bOnline !== aOnline) {
        return bOnline - aOnline;
      }
      // Tertiary: Early Partner first
      const aPartner = a.partnerTier === "EARLY_PARTNER" ? 1 : 0;
      const bPartner = b.partnerTier === "EARLY_PARTNER" ? 1 : 0;
      return bPartner - aPartner;
    });

    // 6. Anonymous Query Logging (Fire & Forget)
    if (query.trim().length >= 2) {
      this.logSearchQuery(query, filters.district, scoredCandidates.length);
    }

    // 7. Paginate results
    const totalCount = scoredCandidates.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = scoredCandidates.slice(startIndex, startIndex + pageSize);

    return {
      results: paginatedResults,
      totalCount,
    };
  }

  /**
   * Fetches featured doctors for homepage discovery
   */
  async getFeaturedDoctors(district: string): Promise<any[]> {
    // Fetch verified doctors who can show on public search in the district
    return prisma.doctor.findMany({
      where: {
        clinicDistrict: { equals: district, mode: "insensitive" },
        verificationStatus: "VERIFIED",
        canShowOnPublic: true,
        deletedAt: null,
      },
      orderBy: [
        { partnerTier: "asc" }, // EARLY_PARTNER is ordered first because Prisma enums are ordered.
        // Wait, PartnerTier order in schema is EARLY_PARTNER (0), STANDARD (1), PREMIUM (2)?
        // Let's sort manually to ensure exact Early Partner -> isOnline -> most patients served
      ],
      take: 50,
    }).then((docs) => {
      // Sort manually: EARLY_PARTNER first -> isOnline first -> jivnicarePatientsServed desc
      return docs
        .sort((a, b) => {
          const aPartner = a.partnerTier === "EARLY_PARTNER" ? 1 : 0;
          const bPartner = b.partnerTier === "EARLY_PARTNER" ? 1 : 0;
          if (bPartner !== aPartner) return bPartner - aPartner;

          const aOnline = a.availabilityStatus === "AVAILABLE" ? 1 : 0;
          const bOnline = b.availabilityStatus === "AVAILABLE" ? 1 : 0;
          if (bOnline !== aOnline) return bOnline - aOnline;

          return b.jivnicarePatientsServed - a.jivnicarePatientsServed;
        })
        .slice(0, 8); // Take top 8
    });
  }

  /**
   * Logs search queries anonymously for analytics (90-day retention)
   */
  logSearchQuery(query: string, district: string | undefined, resultCount: number) {
    prisma.searchLog
      .create({
        data: {
          query: query.toLowerCase().trim().slice(0, 100),
          district,
          resultCount,
        },
      })
      .catch((err) => {
        console.error("Failed to log search query:", err);
      });
  }

  /**
   * Fetches active districts
   */
  async getActiveDistricts() {
    return prisma.district.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Fetches active specialities
   */
  async getActiveSpecialities() {
    return prisma.speciality.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }
}

export const searchService = new SearchService();
