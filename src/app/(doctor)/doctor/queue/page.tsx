"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Activity,
  Loader2,
  MapPin,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export default function DoctorQueuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<any>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState("REGULAR");
  const [advancing, setAdvancing] = useState(false);

  // Walk-in modal state
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinAddress, setWalkinAddress] = useState("");
  const [registeringWalkin, setRegisteringWalkin] = useState(false);

  // Internal notes state
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchQueueData = async () => {
    try {
      const docRes = await fetch("/api/doctor/profile");
      if (!docRes.ok) {
        router.push("/doctor/register");
        return;
      }
      const docData = await docRes.json();
      setDoctor(docData.data.doctor);

      const res = await fetch("/api/doctor/queue");
      if (!res.ok) throw new Error("Failed to fetch queue data");
      const qData = await res.json();
      setQueues(qData.data.queues || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();

    // 30 seconds silent polling
    const interval = setInterval(() => {
      fetchQueueData();
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  // Extract selected queue based on tab
  const activeQueue = queues.find((q) => q.type === currentTab);
  const tokens = activeQueue?.tokens || [];

  // Categorize tokens
  const activeToken = tokens.find(
    (t: any) => t.status === "CALLED" || t.status === "IN_CONSULTATION"
  );

  // Sync internal notes text when active token changes
  useEffect(() => {
    setNotesText(activeToken?.internalNotes || "");
  }, [activeToken?.id, activeToken?.internalNotes]);

  const handleSaveNotes = async () => {
    if (!activeToken) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/doctor/tokens/${activeToken.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: notesText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notes");
      toast.success("Notes saved successfully!");
      // Update local queues state
      setQueues((prevQueues) =>
        prevQueues.map((q) => ({
          ...q,
          tokens: q.tokens.map((t: any) =>
            t.id === activeToken.id ? { ...t, internalNotes: notesText } : t
          ),
        }))
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingNotes(false);
    }
  };
  
  const upcomingTokens = tokens.filter(
    (t: any) => t.status === "READY" || t.status === "BOOKED" || t.status === "AWAITING_ARRIVAL" || t.status === "PAYMENT_PENDING"
  );



  // Advance queue handler (CALL_NEXT or COMPLETE)
  const handleAdvance = async (action: "CALL_NEXT" | "COMPLETE") => {
    if (!activeQueue) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/doctor/queue/advance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId: activeQueue.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to advance queue");

      toast.success(action === "CALL_NEXT" ? "Next patient called!" : "Session completed!");
      fetchQueueData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdvancing(false);
    }
  };

  // Specific token status transitions (Mark No Show)
  const handleTokenTransition = async (tokenId: string, fromStatus: string, toStatus: string) => {
    try {
      const res = await fetch(`/api/doctor/tokens/${tokenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStatus, toStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(`Patient marked as ${toStatus.replace("_", " ")}`);
      fetchQueueData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Register Walk-in handler
  const handleRegisterWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName || !walkinPhone || !walkinAddress) {
      toast.error("Please fill out all receptionist fields.");
      return;
    }

    if (!/^\+91[6-9]\d{9}$/.test(walkinPhone)) {
      toast.error("Phone number must match +91XXXXXXXXXX format");
      return;
    }

    setRegisteringWalkin(true);
    try {
      const res = await fetch("/api/doctor/queue/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: walkinName, phone: walkinPhone, address: walkinAddress, type: currentTab }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register walkin");

      const prefix = currentTab === "EMERGENCY" ? "E" : "#";
      toast.success(`Walk-in registered! Token ${prefix}${data.data.token.tokenNumber}`);
      setWalkinOpen(false);
      setWalkinName("");
      setWalkinPhone("");
      setWalkinAddress("");
      fetchQueueData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRegisteringWalkin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading queue console...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[#1B3F6B]">Queue Console</h1>
              <p className="text-xs text-slate-400">Manage patients and live queue updates</p>
            </div>
          </div>

          <Button
            onClick={() => setWalkinOpen(true)}
            className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl gap-2 text-xs font-semibold"
          >
            <UserPlus className="h-4 w-4" /> Walk-in Register
          </Button>
        </div>

        {/* Tab Selection (Regular vs Emergency) */}
        <Tabs defaultValue="REGULAR" onValueChange={setCurrentTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-white border border-slate-100 rounded-xl p-1 shadow-sm [&>button[data-state=active]]:bg-[#1B3F6B] [&>button[data-state=active]]:text-white">
              <TabsTrigger value="REGULAR" className="rounded-lg text-xs font-semibold px-4">
                Regular Queue
              </TabsTrigger>
              {doctor?.isEmergencyEnabled && (
                <TabsTrigger value="EMERGENCY" className="rounded-lg text-xs font-semibold px-4">
                  Emergency Queue
                </TabsTrigger>
              )}
            </TabsList>
            <Badge variant="outline" className="bg-white text-slate-500 rounded-lg py-1 border-slate-200">
              Total Patients: {tokens.length}
            </Badge>
          </div>

          <TabsContent value="REGULAR" className="mt-0 space-y-6">
            {renderQueueConsole()}
          </TabsContent>
          {doctor?.isEmergencyEnabled && (
            <TabsContent value="EMERGENCY" className="mt-0 space-y-6">
              {renderQueueConsole()}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Walk-in Modal */}
      <Dialog open={walkinOpen} onOpenChange={setWalkinOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B3F6B]">Register Walk-in Patient</DialogTitle>
            <DialogDescription>
              Assign a new walk-in token number for today&apos;s queue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterWalkin}>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="walkinName" className="text-slate-700 text-xs">Patient Full Name</Label>
                <Input
                  id="walkinName"
                  placeholder="e.g. Ram Kumar"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="walkinPhone" className="text-slate-700 text-xs">Mobile Number (with +91)</Label>
                <Input
                  id="walkinPhone"
                  placeholder="e.g. +919876543210"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="walkinAddress" className="text-slate-700 text-xs">Address / Village Name</Label>
                <Input
                  id="walkinAddress"
                  placeholder="e.g. Sikandra, Jamui"
                  value={walkinAddress}
                  onChange={(e) => setWalkinAddress(e.target.value)}
                  className="rounded-xl border-slate-200 mt-1"
                />
              </div>
            </div>
            <DialogFooter className="pt-6 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setWalkinOpen(false)}
                className="rounded-xl text-slate-500 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={registeringWalkin}
                className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl text-xs font-semibold px-6"
              >
                {registeringWalkin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue Token"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderQueueConsole() {
    if (!activeQueue) {
      return (
        <Card className="rounded-2xl border-none shadow-sm bg-white p-10 text-center">
          <p className="text-slate-400 text-sm">No queue initialized for today. It will activate on the first booking or walk-in.</p>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Patient & Controls */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-2xl border-none shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center py-4 px-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <CardTitle className="text-sm font-bold text-slate-700">Currently Serving</CardTitle>
              </div>
              {activeToken && (
                <Badge className="bg-[#1B3F6B] text-white hover:bg-[#1B3F6B]">
                  Token {activeQueue.type === "EMERGENCY" ? "E" : "#"}{activeToken.tokenNumber}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {activeToken ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-[#1B3F6B]">
                        {activeToken.type === "WALKIN"
                          ? activeToken.walkinName
                          : activeToken.patient?.name || "Patient"}
                      </h3>
                      <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                        <Phone className="h-3 w-3" />
                        <span>
                          {activeToken.type === "WALKIN"
                            ? activeToken.walkinPhone
                            : activeToken.patient?.phone || "No phone"}
                        </span>
                      </div>
                      {activeToken.type === "WALKIN" && activeToken.walkinAddress && (
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{activeToken.walkinAddress}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] uppercase font-bold py-1 px-2.5 rounded-lg">
                      {activeToken.type}
                    </Badge>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs text-slate-500">
                    <span>Status: <span className="font-bold text-[#1B3F6B] uppercase">{activeToken.status.replace("_", " ")}</span></span>
                    <span>Issued At: {new Date(activeToken.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Internal Consultation Notes */}
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <Label htmlFor="internalNotes" className="text-slate-600 font-semibold text-xs">
                      Internal Consultation Notes (Not visible to patient)
                    </Label>
                    <textarea
                      id="internalNotes"
                      rows={3}
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="Enter patient diagnosis, prescription info, or follow-up instructions..."
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#1B3F6B] focus:border-[#1B3F6B] outline-none resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes || notesText === (activeToken.internalNotes || "")}
                        className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-lg text-[10px] font-semibold px-3 py-1.5"
                      >
                        {savingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save Notes
                      </Button>
                    </div>
                  </div>

                  {/* Actions for current active token */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleAdvance("COMPLETE")}
                      disabled={advancing}
                      className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl text-xs font-semibold flex-1 py-5"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleTokenTransition(activeToken.id, activeToken.status, "NO_SHOW")
                      }
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-semibold flex-1 py-5"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> No Show
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-700">No Patient in consultation</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Click &quot;Call Next&quot; to call the next patient from the waiting list.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleAdvance("CALL_NEXT")}
                    disabled={advancing || upcomingTokens.length === 0}
                    className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl text-xs font-semibold px-8"
                  >
                    {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Call Next Patient"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick advancement trigger if active token is present */}
          {activeToken && (
            <div className="flex justify-end">
              <Button
                onClick={() => handleAdvance("CALL_NEXT")}
                disabled={advancing || upcomingTokens.length === 0}
                className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl text-xs font-semibold gap-2 py-5 px-6 shadow-sm"
              >
                Call Next Patient <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Waiting / Upcoming List */}
        <Card className="rounded-2xl border-none shadow-sm bg-white h-fit">
          <CardHeader className="py-4 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-700">Waiting List ({upcomingTokens.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {upcomingTokens.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Waiting list is empty
              </div>
            ) : (
              upcomingTokens.map((t: any, idx: number) => (
                <div key={t.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-[#1B3F6B]">
                      {activeQueue.type === "EMERGENCY" ? "E" : "#"}{t.tokenNumber}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {t.type === "WALKIN" ? t.walkinName : t.patient?.name || "Patient"}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-medium">
                        {t.type} | {t.status.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                  {idx === 0 && (
                    <Badge className="bg-emerald-500 text-white border-none text-[8px] font-bold uppercase rounded-md px-1.5 py-0.5">
                      Next Up
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}
