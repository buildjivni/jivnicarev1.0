"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Activity,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  AlertTriangle,
  Loader2,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<any>(null);
  const [stats, setStats] = useState({ booked: 0, completed: 0, noshow: 0, emergency: 0 });
  const [status, setStatus] = useState("OFFLINE");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Dialog state for Break message
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [breakMessage, setBreakMessage] = useState("");

  const fetchData = async () => {
    try {
      // Fetch Profile
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      
      const docRes = await fetch("/api/doctor/profile");
      if (!docRes.ok) {
        // If not registered as doctor, redirect to registration
        router.push("/doctor/register");
        return;
      }
      const docData = await docRes.json();
      const doc = docData.data.doctor;
      if (doc.verificationStatus !== "VERIFIED") {
        router.push("/doctor/register");
        return;
      }
      setDoctor(doc);
      setStatus(doc.availabilityStatus);

      // Fetch Today's Queues
      const queueRes = await fetch("/api/doctor/queue");
      if (queueRes.ok) {
        const qData = await queueRes.json();
        const activeQueues = qData.data.queues || [];
        // Compute stats
        let booked = 0;
        let completed = 0;
        let noshow = 0;
        let emergency = 0;
        activeQueues.forEach((q: any) => {
          q.tokens.forEach((t: any) => {
            const isActive = t.status === "BOOKED" || t.status === "AWAITING_ARRIVAL" || t.status === "READY" || t.status === "CALLED" || t.status === "IN_CONSULTATION" || t.status === "PAYMENT_PENDING";
            if (isActive) {
              if (q.type === "EMERGENCY") {
                emergency++;
              } else {
                booked++;
              }
            } else if (t.status === "COMPLETED") {
              completed++;
            } else if (t.status === "NO_SHOW") {
              noshow++;
            }
          });
        });
        setStats({ booked, completed, noshow, emergency });
      }
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const handleStatusChange = async (newStatus: string, msg = "") => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/doctor/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, breakMessage: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setDoctor(data.data.doctor);
      setStatus(newStatus);
      toast.success(`Availability updated to ${newStatus}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const triggerStatusToggle = (targetStatus: string) => {
    if (targetStatus === "ON_BREAK") {
      setBreakMessage("");
      setBreakDialogOpen(true);
    } else {
      handleStatusChange(targetStatus);
    }
  };

  const handleBreakSubmit = () => {
    if (!breakMessage.trim()) {
      toast.error("Please enter a short break reason / message");
      return;
    }
    setBreakDialogOpen(false);
    handleStatusChange("ON_BREAK", breakMessage);
  };

  const downloadQRSticker = () => {
    toast.loading("Generating your PDF QR sticker...");
    window.open("/api/doctor/qr-sticker", "_blank");
    toast.dismiss();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1B3F6B]">Dr. {doctor?.name}</h1>
              <p className="text-xs text-slate-500 font-medium">
                {doctor?.speciality} | ID: {doctor?.internalDoctorId}
              </p>
            </div>
          </div>

          {/* Availability Status Toggles */}
          <div className="flex flex-wrap gap-2 items-center">
            {updatingStatus && <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-1" />}
            <Button
              size="sm"
              onClick={() => triggerStatusToggle("AVAILABLE")}
              className={`rounded-xl px-4 text-xs font-semibold ${
                status === "AVAILABLE"
                  ? "bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              Online
            </Button>
            <Button
              size="sm"
              onClick={() => triggerStatusToggle("ON_BREAK")}
              className={`rounded-xl px-4 text-xs font-semibold ${
                status === "ON_BREAK"
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              On Break
            </Button>
            <Button
              size="sm"
              onClick={() => triggerStatusToggle("OFFLINE")}
              className={`rounded-xl px-4 text-xs font-semibold ${
                status === "OFFLINE"
                  ? "bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              Offline
            </Button>
          </div>
        </div>

        {/* Break Message Announcement Banner if Break */}
        {status === "ON_BREAK" && doctor?.breakMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Break Message: &quot;{doctor.breakMessage}&quot; (Queue is paused. Toggling Online will clear this).</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500">Awaiting Consultation</CardTitle>
              <Activity className="h-4 w-4 text-[#1B3F6B]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-[#1B3F6B]">{stats.booked}</div>
              <p className="text-xs text-slate-400 mt-1">Patients in today&apos;s queue</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500">Completed Sessions</CardTitle>
              <CheckCircle className="h-4 w-4 text-[#4E9B5A]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-[#4E9B5A]">{stats.completed}</div>
              <p className="text-xs text-slate-400 mt-1">Successfully treated today</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500">No-Show / Missed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-red-500">{stats.noshow}</div>
              <p className="text-xs text-slate-400 mt-1">Patients marked absent</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500">Emergency Queue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-rose-500">{stats.emergency}</div>
              <p className="text-xs text-slate-400 mt-1">Active emergency cases</p>
            </CardContent>
          </Card>
        </div>

        {/* Pricing & waiving premium banner */}
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-r from-[#1B3F6B] to-[#5B9BD5] text-white overflow-hidden">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Badge className="bg-[#4E9B5A] text-white hover:bg-[#4E9B5A] rounded-full px-3 py-1 font-semibold text-xs border-none">
                Early Partner Benefit
              </Badge>
              <h2 className="text-xl font-bold md:text-2xl">All platform and booking charges are Waived!</h2>
              <p className="text-xs text-white/80 max-w-lg">
                JivniCare is fully free for our early 20 clinic partners in Jamui and Deoghar. Monthly software licensing fee (₹2,999) and patient convenience fees are currently ₹0.
              </p>
            </div>
            <div className="bg-white/10 px-4 py-3 rounded-xl border border-white/20 text-center shrink-0">
              <div className="text-sm text-white/90">Platform Savings</div>
              <div className="text-xl font-extrabold text-white">₹2,999 saved / mo</div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Action Links */}
          <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Quick Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button
                onClick={() => router.push("/doctor/queue")}
                className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl py-6 flex flex-col gap-1 items-center justify-center"
              >
                <Users className="h-5 w-5" />
                <span className="text-xs font-semibold">Queue Console</span>
              </Button>
              <Button
                onClick={() => router.push("/doctor/register")}
                variant="outline"
                className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-6 flex flex-col gap-1 items-center justify-center"
              >
                <Calendar className="h-5 w-5 text-[#1B3F6B]" />
                <span className="text-xs font-semibold">Update Schedule</span>
              </Button>
              <Button
                onClick={() => router.push("/doctor/patients")}
                variant="outline"
                className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-6 flex flex-col gap-1 items-center justify-center"
              >
                <Users className="h-5 w-5 text-[#4E9B5A]" />
                <span className="text-xs font-semibold">Patient History</span>
              </Button>
            </div>
          </Card>

          {/* QR Code and Branding */}
          <Card className="rounded-2xl border-none shadow-sm bg-white p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-base">Branded Patient QR sticker</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Download a printable A4 flyer and a 10x10cm sticker layout containing a dynamic booking QR code linked to your JivniCare digital profile page.
              </p>
            </div>
            <div className="pt-4">
              <Button
                onClick={downloadQRSticker}
                className="w-full bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl gap-2 font-semibold"
              >
                <QrCode className="h-4 w-4" /> Download QR Code PDF
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Break message input dialog */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B3F6B]">Set Break Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label htmlFor="breakMsg" className="text-slate-600 text-xs">
              Explain why you are taking a break (shown to patients, e.g. &quot;In surgery until 4 PM&quot;)
            </Label>
            <Input
              id="breakMsg"
              placeholder="e.g. Lunch break / In emergency surgery"
              value={breakMessage}
              onChange={(e) => setBreakMessage(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setBreakDialogOpen(false)}
              className="rounded-xl text-slate-500"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBreakSubmit}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
            >
              Set Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
