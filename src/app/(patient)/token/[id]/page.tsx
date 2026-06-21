"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin, AlertCircle, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import { TokenStatus } from "@prisma/client";
import { getETARangeString } from "@/lib/utils/eta";
import { usePWAInstall } from "@/lib/hooks/usePWAInstall";


export default function TokenTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const tokenId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // PWA installation states
  const { isInstallable, isIOS, triggerInstall } = usePWAInstall();
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  useEffect(() => {
    if (isInstallable || (isIOS && !window.matchMedia("(display-mode: standalone)").matches)) {
      setShowPwaBanner(true);
    }
  }, [isInstallable, isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosSheet(true);
    } else {
      await triggerInstall();
    }
  };

  // Poll for token status updates every 30 seconds
  const fetchTokenStatus = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    } else {
      setIsSyncing(true);
    }
    setSyncError(false);
    try {
      const res = await fetch(`/api/patient/tokens/${tokenId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/token/${tokenId}`);
          return;
        }
        throw new Error("Failed to fetch token details");
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastUpdated(new Date());
        setError(""); // Clear error if it succeeded
      } else {
        if (showLoading || !data) {
          setError(json.error || "Token details unavailable");
        } else {
          setSyncError(true);
        }
      }
    } catch (err) {
      console.error("Background token sync error:", err);
      if (showLoading || !data) {
        setError("Unable to sync queue position. Check connection.");
      } else {
        setSyncError(true);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus(true);

    const interval = setInterval(() => {
      fetchTokenStatus(false);
    }, 30000); // 30 seconds silent polling

    return () => clearInterval(interval);
  }, [tokenId]);

  const handleCancelBooking = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/patient/tokens/${tokenId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setShowCancelModal(false);
        // Refresh token state immediately
        fetchTokenStatus(false);
      } else {
        alert(json.error || "Failed to cancel booking.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Failed to cancel booking.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-primary">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-content-secondary font-medium">Syncing live queue...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-primary">
        <Header />
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-4">
          <AlertCircle className="w-12 h-12 text-status-error" />
          <h2 className="text-xl font-bold text-content-primary">Failed to load booking</h2>
          <p className="text-sm text-content-secondary max-w-xs leading-relaxed">
            {error || "We could not fetch your queue details. This token might belong to another account."}
          </p>
          <Button onClick={() => router.push("/")} className="bg-brand-blue hover:bg-brand-blue-hover text-white">
            Go to Homepage
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const { token, doctor, queue, patientsAhead, currentlyServing } = data;

  const isCancellable = [
    TokenStatus.BOOKED,
    TokenStatus.AWAITING_ARRIVAL,
    TokenStatus.PAYMENT_PENDING,
    TokenStatus.READY,
  ].includes(token.status);

  // Status mapping
  const statusLabels: Record<TokenStatus, { label: string; color: string }> = {
    BOOKED: { label: "Waiting", color: "bg-status-warning text-white" },
    AWAITING_ARRIVAL: { label: "Waiting", color: "bg-status-warning text-white" },
    PAYMENT_PENDING: { label: "Waiting", color: "bg-status-warning text-white" },
    READY: { label: "Ready", color: "bg-status-warning text-white" },
    CALLED: { label: "Called", color: "bg-status-success text-white animate-pulse" },
    IN_CONSULTATION: { label: "In Consultation", color: "bg-brand-blue text-white" },
    COMPLETED: { label: "Completed", color: "bg-disabled-text text-white" },
    NO_SHOW: { label: "No Show", color: "bg-disabled-text text-white" },
    CANCELLED: { label: "Cancelled", color: "bg-status-error text-white" },
    EXPIRED: { label: "Expired", color: "bg-disabled-text text-white" },
  };

  const currentStatus = statusLabels[token.status as TokenStatus] || { label: "Waiting", color: "bg-status-warning text-white" };

  // Calculate Progress Bar value (approximate based on token number vs currently serving)
  const maxProgress = token.tokenNumber;
  const currentProgress = currentlyServing > 0 ? Math.min(currentlyServing, maxProgress) : 0;
  const progressPercent = maxProgress > 0 ? (currentProgress / maxProgress) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />

      <main className="container mx-auto max-w-md px-4 py-6 md:py-10 flex flex-col gap-6">
        
        {/* Offline paused queue notification */}
        {doctor.availabilityStatus === "OFFLINE" && (
          <div className="bg-status-warning/10 border border-status-warning/20 text-status-warning rounded-xl p-4 flex gap-3 items-start animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Doctor is temporarily offline</span>
              <span>The clinic queue is currently paused. Live tracking updates will resume shortly.</span>
            </div>
          </div>
        )}

        {/* Hero Token Card */}
        <div className="bg-surface-card border border-border rounded-2xl shadow-lg p-6 flex flex-col items-center text-center gap-6 relative overflow-hidden">
          
          {/* Header row: Status Badge */}
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-muted font-medium">Live Token tracking</span>
              {isSyncing && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-blue"></span>
                </span>
              )}
              {syncError && (
                <span className="text-[10px] font-semibold text-status-warning animate-pulse">
                  (Sync offline)
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] uppercase font-bold tracking-wider py-0.5 px-3 rounded-full ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
              {lastUpdated && (
                <span className="text-[9px] text-content-muted mt-0.5">
                  Refreshed: {lastUpdated.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Large Hero Token Number */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-widest">Your Token</span>
            <strong className="text-6xl md:text-7xl font-display font-bold text-brand-blue mt-2 leading-none">
              {queue.type === "EMERGENCY" ? "E" : "#"}{token.tokenNumber}
            </strong>
          </div>

          {/* Doctor Details */}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-display font-semibold text-content-primary">
              Dr. {doctor.name}
            </h2>
            <p className="text-xs text-brand-blue font-semibold uppercase tracking-wider">
              {doctor.speciality}
            </p>
          </div>

          {/* Position details */}
          {token.status !== TokenStatus.COMPLETED && token.status !== TokenStatus.CANCELLED && token.status !== TokenStatus.NO_SHOW ? (
            <div className="w-full flex flex-col gap-4 border-t border-border pt-5">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="flex flex-col bg-surface-primary p-3 rounded-xl border border-border/60">
                  <span className="text-xs text-content-secondary">Patients Ahead</span>
                  <span className="text-xl font-bold text-content-primary mt-1">
                    {patientsAhead}
                  </span>
                </div>
                <div className="flex flex-col bg-surface-primary p-3 rounded-xl border border-border/60">
                  <span className="text-xs text-content-secondary">Currently Serving</span>
                  <span className="text-xl font-bold text-content-primary mt-1">
                    {currentlyServing > 0 ? `${queue.type === "EMERGENCY" ? "E" : "#"}${currentlyServing}` : "--"}
                  </span>
                </div>
              </div>

              {/* Estimated Arrival Window */}
              {token.status !== TokenStatus.CALLED && token.status !== TokenStatus.IN_CONSULTATION && (
                <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-xl p-3.5 flex flex-col gap-1 text-center animate-in fade-in duration-200">
                  <span className="text-xs text-content-secondary font-semibold uppercase tracking-wider">Estimated Arrival Window</span>
                  <span className="text-base font-bold text-brand-blue">
                    {getETARangeString(patientsAhead)}
                  </span>
                  <span className="text-[10px] text-content-muted leading-none">
                    *Estimated wait time. Subject to change as patients progress.
                  </span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex justify-between text-xs text-content-muted font-semibold">
                  <span>Start</span>
                  <span>Your Turn</span>
                </div>
                <Progress value={progressPercent} className="h-2.5 bg-surface-secondary [&>div]:bg-brand-blue" />
              </div>
            </div>
          ) : (
            <div className="w-full border-t border-border pt-5 text-center text-sm font-medium text-content-secondary flex flex-col items-center gap-2">
              {token.status === TokenStatus.COMPLETED && (
                <>
                  <CheckCircle2 className="w-8 h-8 text-brand-green" />
                  <span>Consultation Completed! Thank you for choosing JivniCare.</span>
                </>
              )}
              {token.status === TokenStatus.CANCELLED && (
                <>
                  <Ban className="w-8 h-8 text-status-error" />
                  <span>This booking was cancelled.</span>
                </>
              )}
              {token.status === TokenStatus.NO_SHOW && (
                <>
                  <AlertCircle className="w-8 h-8 text-content-muted" />
                  <span>Marked as No-Show. Please register again at the clinic reception if you arrived late.</span>
                </>
              )}
            </div>
          )}

        </div>

        {/* Clinic Info Box */}
        <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider">Clinic Address</h3>
          <div className="text-sm text-content-secondary flex flex-col gap-1.5">
            <p className="font-semibold text-content-primary">🏥 {doctor.clinicName}</p>
            <p className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-content-muted flex-shrink-0" />
              <span>{doctor.clinicAddress}, {doctor.clinicCity}</span>
            </p>
          </div>
        </div>

        {/* PWA Install Promo Box */}
        {showPwaBanner && (
          <div className="bg-gradient-to-r from-brand-blue/10 to-brand-green/10 border border-brand-blue/15 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold text-content-primary">Install JivniCare App</h4>
              <p className="text-xs text-content-secondary">Track your token directly from your home screen.</p>
            </div>
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="bg-brand-blue hover:bg-brand-blue-hover text-white text-xs px-4 border-none"
            >
              Install
            </Button>
          </div>
        )}

        {/* Cancel Button */}
        {isCancellable && (
          <Button
            variant="ghost"
            onClick={() => setShowCancelModal(true)}
            className="w-full text-status-error hover:bg-status-error/5 hover:text-status-error flex items-center justify-center gap-2"
          >
            Cancel Booking
          </Button>
        )}

      </main>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-content-primary">Cancel Appointment Token?</h3>
            <p className="text-sm text-content-secondary mt-2 leading-relaxed">
              This action cannot be undone. Cancelling will free this queue slot for other patients waiting on the list.
            </p>
            
            <div className="flex gap-3 mt-5">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 border-border"
                disabled={cancelling}
              >
                Go Back
              </Button>
              <Button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="flex-1 bg-status-error hover:bg-status-error/90 text-white border-none"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS PWA Instructions Dialog */}
      {showIosSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl p-6 relative animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
            <h3 className="text-lg font-bold text-content-primary">Install JivniCare on iOS</h3>
            <p className="text-sm text-content-secondary mt-2 leading-relaxed">
              Safari browser supports adding JivniCare directly to your home screen for rapid tracking:
            </p>
            
            <div className="mt-4 space-y-3.5 text-sm text-content-secondary">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-blue/10 text-brand-blue font-bold rounded-full flex items-center justify-center text-xs">1</span>
                <span>Tap the **Share** button at the bottom of Safari.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-brand-blue/10 text-brand-blue font-bold rounded-full flex items-center justify-center text-xs">2</span>
                <span>Scroll down and select **&ldquo;Add to Home Screen&rdquo;**.</span>
              </div>
            </div>
            
            <Button
              onClick={() => setShowIosSheet(false)}
              className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white mt-6 rounded-xl border-none"
            >
              Got It
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
