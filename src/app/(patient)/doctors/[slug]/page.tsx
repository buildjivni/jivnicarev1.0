"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Clock, MapPin, Star, UserCheck, ShieldAlert, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import { getETARangeString } from "@/lib/utils/eta";

export default function DoctorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  
  // Booking Form State
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    // 1. Fetch Doctor details by slug
    fetch(`/api/public/doctors/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Doctor not found");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setDoctor(data.data.doctor);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    // 2. Fetch active session
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        if (data.success) {
          setSession(data.data.user);
        }
      })
      .catch(() => setSession(null));
  }, [slug]);

  // Handle opening booking panel
  const handleOpenBooking = () => {
    if (!session) {
      // If not logged in, redirect to login
      router.push(`/login?redirect=/doctors/${slug}`);
      return;
    }
    // Generate idempotency key once on form load
    setIdempotencyKey(crypto.randomUUID());
    setBookingError("");
    setBookingResult(null);
    setBookingOpen(true);
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    setBookingLoading(true);
    setBookingError("");
    try {
      const response = await fetch("/api/patient/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          date: new Date().toISOString(),
          type: "ONLINE",
          idempotencyKey,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBookingResult(data.data);
      } else {
        setBookingError(data.error || "Failed to book appointment. Please try again.");
      }
    } catch (error) {
      console.error(error);
      setBookingError("Connection error. Check your network and try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-primary">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-content-secondary font-medium">Loading profile...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-primary">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <ShieldAlert className="w-12 h-12 text-status-error" />
          <h2 className="text-xl font-bold text-content-primary">Doctor profile not found</h2>
          <p className="text-sm text-content-secondary max-w-xs leading-relaxed">
            The profile you are looking for does not exist, has been suspended, or is private.
          </p>
          <Button onClick={() => router.push("/")} className="bg-brand-blue hover:bg-brand-blue-hover text-white">
            Go to Homepage
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const isAvailable = doctor.availabilityStatus === "AVAILABLE" && doctor.isAcceptingBookings;
  const isOnBreak = doctor.availabilityStatus === "ON_BREAK";
  const isOffline = doctor.availabilityStatus === "OFFLINE";
  const isBusy = doctor.availabilityStatus === "AVAILABLE" && !doctor.isAcceptingBookings; // queue full

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-6 md:py-10 flex flex-col gap-6">
        
        {/* Profile Header Card */}
        <div className="bg-surface-card border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          
          {/* Avatar / Photo */}
          <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-xl overflow-hidden bg-surface-secondary flex-shrink-0 flex items-center justify-center shadow-inner self-center md:self-auto">
            {doctor.profilePhoto ? (
              <Image
                src={doctor.profilePhoto}
                alt={doctor.name}
                fill
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZWZmNmZmIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2RiZWFmZSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
                className={`object-cover ${isOnBreak || isOffline ? "saturate-[0.6] brightness-[0.95]" : ""}`}
              />
            ) : (
              <div className="text-4xl text-content-muted font-bold font-display">
                {doctor.name.split(" ").pop()?.charAt(0) || "D"}
              </div>
            )}
          </div>

          {/* Doctor Details */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h1 className="text-xl md:text-2xl font-display font-semibold text-content-primary flex items-center gap-1.5">
                  {doctor.name}
                  <span title="Verified NMC Practitioner"><UserCheck className="w-5 h-5 text-brand-green" /></span>
                </h1>
                <p className="text-sm font-semibold text-brand-blue uppercase tracking-wider mt-0.5">
                  {doctor.speciality}
                </p>
              </div>

              {doctor.partnerTier === "EARLY_PARTNER" && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none py-0.5 px-3 flex items-center gap-1.5 rounded-full w-fit">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Early Partner
                </Badge>
              )}
            </div>

            {/* Verification / Credentials */}
            <div className="text-sm text-content-secondary flex flex-col gap-1">
              <p>🎓 {doctor.qualifications?.join(", ") || "MBBS"}</p>
              <p>💼 {doctor.experienceYears} Years of Clinical Experience</p>
              <p className="text-content-muted">NMC Registration No: {doctor.registrationNumber}</p>
            </div>

            {/* Availability Badge */}
            <div className="flex items-center gap-2 mt-1">
              {isAvailable && (
                <span className="text-xs font-semibold text-brand-green bg-brand-green/10 border border-brand-green/20 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-green" />
                  Available Today
                </span>
              )}
              {isOnBreak && (
                <span className="text-xs font-semibold text-status-warning bg-status-warning/10 border border-status-warning/20 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-warning" />
                  On a Short Break
                </span>
              )}
              {isBusy && (
                <span className="text-xs font-semibold text-brand-navy bg-brand-navy/10 border border-brand-navy/20 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-navy animate-pulse" />
                  Queue Full
                </span>
              )}
              {isOffline && (
                <span className="text-xs font-semibold text-disabled-text bg-disabled-bg border border-disabled-border px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-disabled-text" />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Booking Alert & CTA Banner */}
        <div className="bg-surface-card border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-content-secondary uppercase">Same-Day Consultation Fee</h3>
            <div className="text-2xl font-display font-bold text-content-primary">
              ₹{doctor.consultationFee}
            </div>
            <div className="text-xs text-brand-green font-semibold flex items-center gap-1">
              <span>Convenience Fee:</span>
              <span className="line-through text-content-muted">₹29</span>
              <span>FREE 🎉</span>
            </div>
          </div>

          <Button
            onClick={handleOpenBooking}
            disabled={isOffline || isBusy}
            className={`w-full sm:w-auto text-white font-semibold text-base py-3 px-8 rounded-lg shadow border-none ${
              isOffline || isBusy
                ? "bg-disabled-bg text-disabled-text cursor-not-allowed"
                : "bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-blue-active"
            }`}
          >
            {isBusy ? "Queue Full" : isOffline ? "Doctor Offline" : "Book Same-Day Token"}
          </Button>
        </div>

        {/* Details Grid: Schedule & Bio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bio & Details (Left col) */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Bio */}
            {doctor.bio && (
              <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-base font-semibold text-content-primary mb-3">About the Doctor</h3>
                <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-line italic">
                  &ldquo;{doctor.bio}&rdquo;
                </p>
              </div>
            )}

            {/* Clinic details */}
            <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-base font-semibold text-content-primary">Clinic Location</h3>
              <div className="text-sm text-content-secondary flex flex-col gap-2">
                <p className="font-semibold text-content-primary">🏥 {doctor.clinicName}</p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-content-muted" />
                  <span>{doctor.clinicAddress}, {doctor.clinicCity}, {doctor.clinicDistrict}</span>
                </p>
                {doctor.clinicPincode && <p>Pincode: {doctor.clinicPincode}</p>}
              </div>
            </div>
          </div>

          {/* Schedule (Right col) */}
          <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-base font-semibold text-content-primary flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-blue" />
              Weekly Clinic Hours
            </h3>
            
            <div className="text-sm text-content-secondary flex flex-col gap-2.5">
              {doctor.weeklySchedule && typeof doctor.weeklySchedule === "object" ? (
                Object.entries(doctor.weeklySchedule).map(([day, time]: any) => (
                  <div key={day} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                    <span className="font-medium text-content-primary capitalize">{day}</span>
                    <span className="text-xs text-brand-green font-semibold bg-brand-green/5 px-2 py-0.5 rounded">
                      {time || "Closed"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-content-muted">Clinic timings not uploaded yet.</p>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Same-Day Booking Modal/Drawer */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            
            {/* Close Button */}
            <button
              onClick={() => setBookingOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-primary p-1"
            >
              ✕
            </button>

            {/* Success screen */}
            {bookingResult ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <CheckCircle className="w-16 h-16 text-brand-green" />
                <h3 className="text-xl font-bold text-content-primary">Appointment Confirmed!</h3>
                
                <div className="bg-surface-primary border border-border p-4 rounded-xl w-full flex flex-col items-center">
                  <span className="text-xs font-semibold text-content-secondary uppercase">Your Token Number</span>
                  <strong className="text-4xl font-display font-bold text-brand-blue mt-1">
                    #{bookingResult.tokenNumber}
                  </strong>
                  <span className="text-xs text-content-muted mt-2">
                    {bookingResult.patientsAhead} patients ahead of you
                  </span>
                  <div className="w-full border-t border-border mt-3 pt-3 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-content-secondary uppercase tracking-wider">Estimated Arrival Window</span>
                    <span className="text-sm font-bold text-brand-blue mt-0.5">
                      {getETARangeString(bookingResult.patientsAhead)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-content-secondary leading-relaxed">
                  We have registered your same-day booking with Dr. {doctor.name}. You can track your queue position live.
                </p>

                <Button
                  onClick={() => {
                    setBookingOpen(false);
                    router.push(`/token/${bookingResult.tokenId}`);
                  }}
                  className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white flex items-center justify-center gap-1.5 mt-2"
                >
                  Track Live Queue Position
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* Confirm booking screen */
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-content-primary">Confirm Appointment Token</h3>
                
                <div className="bg-surface-primary border border-border p-4 rounded-xl flex flex-col gap-2.5 text-sm text-content-secondary">
                  <p><strong>Doctor:</strong> {doctor.name}</p>
                  <p><strong>Speciality:</strong> {doctor.speciality}</p>
                  <p><strong>Clinic:</strong> {doctor.clinicName}</p>
                  <p><strong>Date:</strong> Today ({new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })})</p>
                </div>

                <div className="flex items-center justify-between border-t border-border/80 pt-3 text-sm">
                  <span>Consultation Fee:</span>
                  <strong className="text-content-primary">₹{doctor.consultationFee}</strong>
                </div>

                <div className="flex items-center justify-between text-sm text-brand-green font-semibold">
                  <span>Convenience Fee:</span>
                  <span>FREE 🎉</span>
                </div>

                {bookingError && (
                  <div className="bg-status-error/10 border border-status-error/20 text-status-error p-3 rounded-lg text-xs font-semibold leading-relaxed">
                    ⚠️ {bookingError === "BOOKING_LIMIT_EXCEEDED" ? "You already have 3 active bookings today." : bookingError}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setBookingOpen(false)}
                    className="flex-1 border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading}
                    className="flex-1 bg-brand-green hover:bg-brand-green-hover text-white border-none"
                  >
                    {bookingLoading ? "Confirming..." : "Confirm & Book"}
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
