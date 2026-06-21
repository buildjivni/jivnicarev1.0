"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, MapPin, Star, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvailabilityStatus, PartnerTier } from "@prisma/client";

interface DoctorCardProps {
  doctor: {
    id: string;
    name: string;
    slug: string;
    speciality: string;
    clinicName: string;
    clinicCity: string;
    clinicDistrict: string;
    consultationFee: number;
    availabilityStatus: AvailabilityStatus;
    isAcceptingBookings: boolean;
    partnerTier: PartnerTier;
    profilePhoto: string | null;
    bio: string | null;
    breakMessage?: string | null;
    patientsAhead?: number;
  };
}

export default function DoctorCard({ doctor }: DoctorCardProps) {
  const isAvailable = doctor.availabilityStatus === "AVAILABLE" && doctor.isAcceptingBookings;
  const isOnBreak = doctor.availabilityStatus === "ON_BREAK";
  const isOffline = doctor.availabilityStatus === "OFFLINE";
  const isBusy = doctor.availabilityStatus === "AVAILABLE" && !doctor.isAcceptingBookings; // queue full

  return (
    <div className="w-full bg-surface-card border border-border rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden flex flex-col md:flex-row gap-5 p-4 md:p-5">
      
      {/* Doctor Image & HTML overlay badges */}
      <div className="relative w-full md:w-32 h-36 md:h-32 rounded-lg overflow-hidden bg-surface-secondary flex-shrink-0 flex items-center justify-center">
        {doctor.profilePhoto ? (
          <Image
            src={doctor.profilePhoto}
            alt={doctor.name}
            fill
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZWZmNmZmIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2RiZWFmZSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
            className={`object-cover transition-transform duration-300 hover:scale-105 ${
              isOnBreak || isOffline ? "saturate-[0.6] brightness-[0.95]" : ""
            }`}
          />
        ) : (
          <div className="text-4xl text-content-muted font-display font-bold">
            {doctor.name.split(" ").pop()?.charAt(0) || "D"}
          </div>
        )}

        {/* HTML/CSS Status Badge Overlay (Top Left) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          {doctor.partnerTier === "EARLY_PARTNER" && (
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none text-[10px] font-semibold py-0.5 px-2 flex items-center gap-1 rounded-full shadow-sm">
              <Star className="w-2.5 h-2.5 fill-current" />
              Early Partner
            </Badge>
          )}
        </div>

        {/* HTML/CSS Availability Indicator (Bottom Right) */}
        <div className="absolute bottom-2 right-2 z-10">
          {isAvailable && (
            <Badge className="bg-status-success hover:bg-status-success text-white border-none text-[10px] py-0.5 px-2 rounded-full">
              Online
            </Badge>
          )}
          {isOnBreak && (
            <Badge className="bg-status-warning hover:bg-status-warning text-white border-none text-[10px] py-0.5 px-2 rounded-full">
              On Break
            </Badge>
          )}
          {isBusy && (
            <Badge className="bg-brand-navy hover:bg-brand-navy text-white border-none text-[10px] py-0.5 px-2 rounded-full">
              Queue Full
            </Badge>
          )}
          {isOffline && (
            <Badge className="bg-disabled-text hover:bg-disabled-text text-white border-none text-[10px] py-0.5 px-2 rounded-full">
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Doctor Info Section */}
      <div className="flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Header row: Name & Speciality */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 mb-1.5">
            <h3 className="text-lg md:text-xl font-display font-semibold text-content-primary flex items-center gap-1.5">
              {doctor.name}
              <span title="Verified Professional"><UserCheck className="w-5 h-5 text-brand-green" /></span>
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/5 px-2.5 py-0.5 rounded-full border border-brand-blue/10 self-start md:self-auto">
              {doctor.speciality}
            </span>
          </div>

          {/* Clinic Name and City info */}
          <div className="flex flex-col gap-1 text-sm text-content-secondary mb-2">
            <p className="font-semibold text-content-primary flex items-center gap-1.5">
              <span>🏥 {doctor.clinicName}</span>
            </p>
            <p className="flex items-center gap-1.5 text-content-secondary">
              <MapPin className="w-3.5 h-3.5 text-content-muted" />
              <span>{doctor.clinicCity}, {doctor.clinicDistrict}</span>
            </p>
          </div>

          {/* Bio snippet */}
          {doctor.bio && (
            <p className="text-sm text-content-secondary line-clamp-2 italic leading-relaxed">
              &ldquo;{doctor.bio}&rdquo;
            </p>
          )}

          {/* Short Break Message alert */}
          {isOnBreak && doctor.breakMessage && (
            <div className="mt-2 bg-status-warning/10 border border-status-warning/20 text-status-warning text-xs font-medium px-3 py-1.5 rounded-md">
              📢 {doctor.breakMessage}
            </div>
          )}

          {/* Queue Wait details */}
          {doctor.patientsAhead !== undefined && doctor.patientsAhead > 0 && (
            <div className="mt-2 text-xs font-semibold text-brand-blue bg-brand-blue/5 border border-brand-blue/15 px-3 py-1 rounded-md flex items-center gap-1.5 w-fit">
              <Clock className="w-3.5 h-3.5" />
              <span>{doctor.patientsAhead} patients ahead in queue</span>
            </div>
          )}
        </div>

        {/* Action and Pricing section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border/60">
          
          {/* Strike-through fee pricing */}
          <div className="flex flex-col">
            <div className="text-sm text-content-secondary">
              Consultation Fee: <strong className="text-content-primary font-display">₹{doctor.consultationFee}</strong>
            </div>
            <div className="text-xs text-brand-green font-semibold flex items-center gap-1">
              <span>Convenience Fee:</span>
              <span className="line-through text-content-muted">₹29</span>
              <span>FREE 🎉</span>
            </div>
          </div>

          {/* Book Action Button */}
          <div className="flex gap-2">
            <Link href={`/doctors/${doctor.slug}`}>
              <Button variant="outline" className="border-border hover:bg-surface-primary">View Profile</Button>
            </Link>
            
            {isOffline || isBusy ? (
              <Button
                disabled
                className="text-white border-none bg-disabled-bg text-disabled-text cursor-not-allowed"
              >
                {isBusy ? "Queue Full" : "Offline"}
              </Button>
            ) : (
              <Link href={`/doctors/${doctor.slug}`}>
                <Button
                  className="text-white border-none bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-blue-active"
                >
                  Book Same-Day
                </Button>
              </Link>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
