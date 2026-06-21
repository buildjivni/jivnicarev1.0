"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  UserPlus,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [doctorsList, setDoctorsList] = useState<any>({ PENDING_REVIEW: [], VERIFIED: [], REJECTED: [], SUSPENDED: [], PENDING_ACTIVATION: [] });
  const [queueHealth, setQueueHealth] = useState<any[]>([]);
  const [searchInsights, setSearchInsights] = useState<any>(null);

  // Dialog for onboarding
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardName, setOnboardName] = useState("");
  const [onboardPhone, setOnboardPhone] = useState("");
  const [onboardSpeciality, setOnboardSpeciality] = useState("");
  const [onboarding, setOnboarding] = useState(false);

  // Dialog for pricing config
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingDoctorId, setPricingDoctorId] = useState("");
  const [pricingTier, setPricingTier] = useState("STANDARD");
  const [pricingDiscount, setPricingDiscount] = useState("100");
  const [pricingMonthly, setPricingMonthly] = useState("0");
  const [pricingBooking, setPricingBooking] = useState("0");
  const [configuringPricing, setConfiguringPricing] = useState(false);

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      // 1. Fetch Stats
      const statsRes = await fetch("/api/admin/stats");
      if (!statsRes.ok) {
        if (statsRes.status === 401 || statsRes.status === 403) {
          router.push("/admin/login");
          return;
        }
        throw new Error("Failed to load statistics");
      }
      const statsData = await statsRes.json();
      setStats(statsData.data);

      // 2. Fetch Doctors List
      const docRes = await fetch("/api/admin/doctors");
      if (docRes.ok) {
        const docData = await docRes.json();
        setDoctorsList(docData.data.grouped || {});
      }

      // 3. Fetch Queue Health
      const qRes = await fetch("/api/admin/queue-health");
      if (qRes.ok) {
        const qData = await qRes.json();
        setQueueHealth(qData.data.queues || []);
      }

      // 4. Fetch Search Insights
      const searchRes = await fetch("/api/admin/search-insights");
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        setSearchInsights(searchData.data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [router]);

  const handleOnboardDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardName || !onboardPhone || !onboardSpeciality) {
      toast.error("Please fill out all fields.");
      return;
    }

    if (!/^\+91[6-9]\d{9}$/.test(onboardPhone)) {
      toast.error("Invalid phone format (+91XXXXXXXXXX)");
      return;
    }

    setOnboarding(true);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: onboardName, phone: onboardPhone, speciality: onboardSpeciality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to onboard doctor");

      toast.success(`Doctor onboarded! ID: ${data.data.doctor.internalDoctorId}`);
      setOnboardOpen(false);
      setOnboardName("");
      setOnboardPhone("");
      setOnboardSpeciality("");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOnboarding(false);
    }
  };

  const handlePricingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingDoctorId) return;

    setConfiguringPricing(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: pricingDoctorId,
          partnerTier: pricingTier,
          discountPercent: parseInt(pricingDiscount, 10),
          monthlyFee: parseInt(pricingMonthly, 10),
          perBookingFee: parseInt(pricingBooking, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pricing configuration");

      toast.success("Pricing updated successfully!");
      setPricingOpen(false);
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfiguringPricing(false);
    }
  };

  const triggerPricingDialog = (doc: any) => {
    setPricingDoctorId(doc.id);
    setPricingTier(doc.partnerTier || "STANDARD");
    setPricingDiscount(doc.platformPricing?.discountPercent?.toString() || "100");
    setPricingMonthly(doc.platformPricing?.monthlyFee?.toString() || "0");
    setPricingBooking(doc.platformPricing?.perBookingFee?.toString() || "0");
    setPricingOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading admin console...</p>
      </div>
    );
  }

  const pendingDoctors = doctorsList.PENDING_REVIEW || [];
  const verifiedDoctors = doctorsList.VERIFIED || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1B3F6B]">Command Center</h1>
              <p className="text-xs text-slate-500 font-medium">JivniCare Portal | Jamui + Deoghar v1.0.0</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setOnboardOpen(true)}
              className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl gap-2 text-xs font-semibold px-5 py-5"
            >
              <UserPlus className="h-4 w-4" /> Onboard Doctor
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold text-slate-400">Online Doctors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-[#4E9B5A]">{stats?.onlineDoctors || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold text-slate-400">Total Bookings Today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-[#1B3F6B]">{stats?.bookingsCount || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold text-slate-400">Active Queues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-[#1B3F6B]">{stats?.queueCount || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold text-slate-400">Pending Reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-extrabold text-red-500">{stats?.pendingVerifications || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area (Pending Reviews and Queue Health) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pending Doctor Reviews */}
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row justify-between items-center px-6">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">Pending Registrations ({pendingDoctors.length})</CardTitle>
                  <CardDescription className="text-[10px]">Verify documents and activate profiles</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-50">
                {pendingDoctors.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No pending doctor reviews currently.
                  </div>
                ) : (
                  pendingDoctors.map((doc: any) => (
                    <div
                      key={doc.id}
                      onClick={() => router.push(`/admin/doctors/${doc.id}`)}
                      className="p-4 flex justify-between items-center hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Dr. {doc.name}</h4>
                        <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
                          <span>ID: {doc.internalDoctorId}</span>
                          <span>|</span>
                          <span>Speciality: {doc.speciality}</span>
                          <span>|</span>
                          <span>District: {doc.clinicDistrict}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Queue Health Grid */}
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="py-4 border-b border-slate-50 px-6">
                <CardTitle className="text-sm font-bold text-slate-700">Active Queue Monitor</CardTitle>
                <CardDescription className="text-[10px]">Real-time operational status of clinic queues today</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3">Clinic & Doctor</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Token Progress</th>
                        <th className="p-3 text-right">Metrics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queueHealth.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No queues active today yet.
                          </td>
                        </tr>
                      ) : (
                        queueHealth.map((queue) => (
                          <tr key={queue.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className="font-bold text-slate-800">Dr. {queue.doctorName}</span>
                              <span className="block text-[10px] text-slate-400">{queue.clinicName}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className={queue.type === "EMERGENCY" ? "border-amber-200 text-amber-700 bg-amber-50" : "border-slate-200 text-slate-600 bg-slate-50"}>
                                {queue.type}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={queue.status === "ACTIVE" ? "bg-[#4E9B5A] text-white hover:bg-[#4E9B5A]" : "bg-slate-200 text-slate-600 hover:bg-slate-200"}>
                                {queue.status}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-[#1B3F6B]">
                              {queue.activeCount} Wait / {queue.completedCount} Done
                            </td>
                            <td className="p-3 text-right font-medium text-slate-500">
                              Tokens: {queue.totalTokens} / {queue.dailyLimit}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar (Search Insights & Pricing Settings) */}
          <div className="space-y-8">
            {/* Search Insights Widget */}
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="py-4 border-b border-slate-50 px-6">
                <CardTitle className="text-sm font-bold text-slate-700">Search Insights (Top 5)</CardTitle>
                <CardDescription className="text-[10px]">Aggregate analytics on patient search keywords</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {searchInsights ? (
                  <>
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Popular Symptom Queries
                      </span>
                      {searchInsights.topQueries.slice(0, 5).map((q: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl">
                          <span className="font-semibold text-slate-700">{q.query}</span>
                          <Badge variant="secondary" className="bg-[#1B3F6B]/10 text-[#1B3F6B] border-none text-[10px] font-bold">
                            {q.count} hits
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">
                        Zero-Result (Unserved) Queries
                      </span>
                      {searchInsights.zeroResultQueries.slice(0, 5).map((q: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-red-50/50 rounded-xl">
                          <span className="font-semibold text-red-800">{q.query}</span>
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] font-bold border-none">
                            {q.count} times
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-xs text-slate-400 py-6">No search logs available.</div>
                )}
              </CardContent>
            </Card>

            {/* Verified Doctors & Pricing Setup */}
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="py-4 border-b border-slate-50 px-6">
                <CardTitle className="text-sm font-bold text-slate-700">Early Partner Tiers</CardTitle>
                <CardDescription className="text-[10px]">Configure billing and waive platform settings</CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                {verifiedDoctors.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No verified doctors active.
                  </div>
                ) : (
                  verifiedDoctors.map((doc: any) => (
                    <div key={doc.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          Dr. {doc.name}
                          {doc.partnerTier === "EARLY_PARTNER" && (
                            <Badge className="bg-amber-400 text-amber-950 font-bold border-none text-[8px] rounded px-1 flex items-center gap-0.5">
                              <Sparkles className="h-2 w-2" /> GOLD
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tier: {doc.partnerTier} | Fee: ₹{doc.consultationFee}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => triggerPricingDialog(doc)}
                        className="text-[#1B3F6B] hover:text-[#1B3F6B]/90 hover:bg-[#1B3F6B]/5 text-xs rounded-lg px-2 h-7"
                      >
                        Pricing
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Onboard Doctor Dialog */}
      <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
        <DialogContent className="rounded-2xl max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#1B3F6B] font-bold">Onboard New Doctor</DialogTitle>
            <DialogDescription>Create a verified doctor user and start onboarding steps.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOnboardDoctor}>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="onboardName" className="text-slate-700 text-xs">Full Name</Label>
                <Input
                  id="onboardName"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={onboardName}
                  onChange={(e) => setOnboardName(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="onboardPhone" className="text-slate-700 text-xs">Phone Number (+91)</Label>
                <Input
                  id="onboardPhone"
                  placeholder="e.g. +919876543210"
                  value={onboardPhone}
                  onChange={(e) => setOnboardPhone(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="onboardSpeciality" className="text-slate-700 text-xs">Speciality</Label>
                <Input
                  id="onboardSpeciality"
                  placeholder="e.g. General Physician"
                  value={onboardSpeciality}
                  onChange={(e) => setOnboardSpeciality(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>
            </div>
            <DialogFooter className="pt-6 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOnboardOpen(false)}
                className="rounded-xl text-slate-500 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={onboarding}
                className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl text-xs font-semibold px-6"
              >
                {onboarding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onboard"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configure Pricing Dialog */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="rounded-2xl max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#1B3F6B] font-bold">Configure Doctor Billing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePricingConfig}>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="pricingTier" className="text-slate-700 text-xs">Partner Tier</Label>
                <select
                  id="pricingTier"
                  value={pricingTier}
                  onChange={(e) => setPricingTier(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                >
                  <option value="STANDARD">Standard Clinic</option>
                  <option value="EARLY_PARTNER">Early Partner (Waived - Gold Badge)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="pricingDiscount" className="text-slate-700 text-xs">Discount Percent (%)</Label>
                <Input
                  id="pricingDiscount"
                  type="number"
                  min={0}
                  max={100}
                  value={pricingDiscount}
                  onChange={(e) => setPricingDiscount(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pricingMonthly" className="text-slate-700 text-xs">Monthly Fee (₹)</Label>
                  <Input
                    id="pricingMonthly"
                    type="number"
                    value={pricingMonthly}
                    onChange={(e) => setPricingMonthly(e.target.value)}
                    className="rounded-xl border-slate-200 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="pricingBooking" className="text-slate-700 text-xs">Per-Booking Fee (₹)</Label>
                  <Input
                    id="pricingBooking"
                    type="number"
                    value={pricingBooking}
                    onChange={(e) => setPricingBooking(e.target.value)}
                    className="rounded-xl border-slate-200 mt-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-6 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPricingOpen(false)}
                className="rounded-xl text-slate-500 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={configuringPricing}
                className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl text-xs font-semibold px-6"
              >
                {configuringPricing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save config"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
