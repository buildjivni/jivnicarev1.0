"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ArrowRight, ShieldAlert, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import { TokenStatus } from "@prisma/client";

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patient/bookings")
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login?redirect=/bookings");
            return;
          }
          throw new Error("Failed to load bookings");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setBookings(data.data.bookings || []);
        } else {
          setError(data.error || "Failed to load bookings");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Unable to sync booking history. Check your network.");
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatusStyle = (status: TokenStatus) => {
    switch (status) {
      case TokenStatus.BOOKED:
      case TokenStatus.AWAITING_ARRIVAL:
      case TokenStatus.PAYMENT_PENDING:
      case TokenStatus.READY:
        return "bg-status-warning/10 text-status-warning border-status-warning/20";
      case TokenStatus.CALLED:
        return "bg-status-success/10 text-status-success border-status-success/20 animate-pulse";
      case TokenStatus.IN_CONSULTATION:
        return "bg-brand-blue/10 text-brand-blue border-brand-blue/20";
      case TokenStatus.COMPLETED:
        return "bg-disabled-bg/50 text-content-secondary border-disabled-border/30";
      case TokenStatus.CANCELLED:
      case TokenStatus.EXPIRED:
        return "bg-status-error/10 text-status-error border-status-error/20";
      case TokenStatus.NO_SHOW:
        return "bg-disabled-bg/50 text-content-secondary border-disabled-border/30";
      default:
        return "bg-surface-secondary text-content-secondary";
    }
  };

  const getStatusLabel = (status: TokenStatus) => {
    if (status === "BOOKED" || status === "AWAITING_ARRIVAL" || status === "PAYMENT_PENDING" || status === "READY") {
      return "Waiting";
    }
    if (status === "IN_CONSULTATION") {
      return "In Consultation";
    }
    return status.replace("_", " ");
  };

  const isLive = (status: TokenStatus) => {
    return ([
      TokenStatus.BOOKED,
      TokenStatus.AWAITING_ARRIVAL,
      TokenStatus.PAYMENT_PENDING,
      TokenStatus.READY,
      TokenStatus.CALLED,
      TokenStatus.IN_CONSULTATION,
    ] as TokenStatus[]).includes(status);
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />

      <main className="container mx-auto max-w-xl px-4 py-6 md:py-10 flex flex-col gap-6">
        
        <div>
          <h1 className="text-2xl font-display font-bold text-content-primary">
            My Appointments
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Track and manage your same-day booking tokens
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-32 bg-surface-card border border-border rounded-xl" />
            <div className="h-32 bg-surface-card border border-border rounded-xl" />
          </div>
        ) : error ? (
          <div className="bg-surface-card border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3">
            <ShieldAlert className="w-10 h-10 text-status-error" />
            <p className="text-sm text-content-primary font-medium">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm" className="bg-brand-blue hover:bg-brand-blue-hover text-white">
              Try Again
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-xl p-8 text-center flex flex-col items-center gap-4">
            <Calendar className="w-12 h-12 text-content-muted" />
            <h3 className="text-lg font-semibold text-content-primary">No appointments yet</h3>
            <p className="text-sm text-content-secondary max-w-xs leading-relaxed">
              JivniCare connects you directly with leading clinics. Book a token for same-day priority checkups.
            </p>
            <Link href="/search">
              <Button className="bg-brand-blue hover:bg-brand-blue-hover text-white mt-1 gap-1.5">
                <Search className="w-4 h-4" />
                Find a Doctor
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.map((booking) => {
              const doc = booking.queue.doctor;
              const dateObj = new Date(booking.queue.date);
              const formattedDate = dateObj.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={booking.id}
                  className="bg-surface-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-4 hover:shadow-card transition-all duration-200"
                >
                  {/* Top Row: Token & Date */}
                  <div className="flex justify-between items-start border-b border-border/50 pb-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-content-muted uppercase tracking-widest font-semibold">Token</span>
                      <strong className="text-2xl font-display font-bold text-brand-blue mt-0.5">
                        #{booking.tokenNumber}
                      </strong>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-content-muted">{formattedDate}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider py-0.5 px-2.5 border rounded-full ${getStatusStyle(booking.status as TokenStatus)}`}>
                        {getStatusLabel(booking.status as TokenStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Doctor & Clinic Info */}
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col gap-1 text-sm text-content-secondary">
                      <h3 className="font-display font-semibold text-content-primary text-base">
                        Dr. {doc.name}
                      </h3>
                      <p className="text-brand-blue text-xs font-semibold uppercase tracking-wider">{doc.speciality}</p>
                      <p className="text-xs flex items-center gap-1 mt-1 text-content-muted">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{doc.clinicName}, {doc.clinicCity}</span>
                      </p>
                    </div>

                    {isLive(booking.status as TokenStatus) && (
                      <Link href={`/token/${booking.id}`} className="self-center">
                        <Button
                          size="sm"
                          className="bg-brand-blue hover:bg-brand-blue-hover text-white flex items-center gap-1 border-none"
                        >
                          Track Live
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
