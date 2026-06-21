"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  User,
  MapPin,
  Calendar,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export default function DoctorReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const doctorId = params.id;
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchDoctorDetails = async () => {
    try {
      const res = await fetch(`/api/admin/doctors`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/admin/login");
          return;
        }
        throw new Error("Failed to load doctors");
      }
      const data = await res.json();
      const doc = data.data.doctors.find((d: any) => d.id === doctorId);
      if (!doc) throw new Error("Doctor not found in system");
      setDoctor(doc);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load doctor details");
      router.push("/admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorDetails();
  }, [doctorId, router]);

  const handleAction = async (action: "APPROVE" | "REJECT") => {
    const noteOrReason = action === "APPROVE" ? reviewNote : rejectReason;
    if (!noteOrReason.trim()) {
      toast.error(action === "APPROVE" ? "Please enter a verification note." : "Please enter a rejection reason.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: action === "APPROVE" ? noteOrReason : undefined,
          reason: action === "REJECT" ? noteOrReason : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification action failed");

      toast.success(action === "APPROVE" ? "Doctor approved successfully!" : "Doctor request rejected.");
      router.push("/admin");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading doctor profile for review...</p>
      </div>
    );
  }

  const weeklySchedule = doctor.weeklySchedule as Record<string, any> | null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 flex flex-col">
      <div className="max-w-6xl w-full mx-auto space-y-6 flex-1 flex flex-col">
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin")}
            className="text-slate-500 hover:text-slate-700 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 rounded-lg">
            Verification status: {doctor.verificationStatus}
          </Badge>
        </div>

        {/* Side by Side layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
          {/* Left Pane: Doctor Metadata */}
          <div className="space-y-6">
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-3">
                <div className="h-10 w-10 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">Doctor Profile</CardTitle>
                  <CardDescription className="text-[10px]">Basic info, registration and qualifications</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Name</span>
                    <span className="font-bold text-slate-800 text-sm">Dr. {doctor.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Speciality</span>
                    <span className="font-semibold text-slate-800">{doctor.speciality}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Phone</span>
                    <span className="font-medium text-slate-700">{doctor.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Gender / Exp</span>
                    <span className="font-medium text-slate-700">{doctor.gender} | {doctor.experienceYears} Years</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">NMC Registration Number</span>
                    <Badge variant="secondary" className="bg-[#1B3F6B]/10 text-[#1B3F6B] border-none font-bold">
                      {doctor.registrationNumber || "Not Provided"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Languages Spoken</span>
                    <span className="font-medium text-slate-700">{doctor.languages.join(", ")}</span>
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-4 text-xs">
                  <span className="text-slate-400 block mb-1">Qualifications</span>
                  <div className="flex flex-wrap gap-1">
                    {doctor.qualifications.map((q: string, i: number) => (
                      <Badge key={i} variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
                        {q}
                      </Badge>
                    ))}
                  </div>
                </div>

                {doctor.bio && (
                  <div className="border-t border-slate-50 pt-4 text-xs">
                    <span className="text-slate-400 block mb-1">Bio / About</span>
                    <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                      {doctor.bio}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-3">
                <div className="h-10 w-10 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">Clinic Details</CardTitle>
                  <CardDescription className="text-[10px]">Clinic location and operator phone numbers</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Clinic Name</span>
                    <span className="font-bold text-slate-800 text-sm">{doctor.clinicName || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Address</span>
                    <span className="font-semibold text-slate-700">{doctor.clinicAddress}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">City / District</span>
                    <span className="font-medium text-slate-700">{doctor.clinicCity}, {doctor.clinicDistrict}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Pincode</span>
                    <span className="font-medium text-slate-700">{doctor.clinicPincode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Operator Contact</span>
                    <span className="font-semibold text-slate-800">{doctor.operatorName} | {doctor.operatorMobile}</span>
                  </div>
                  {doctor.receptionist1Name && (
                    <div>
                      <span className="text-slate-400 block mb-0.5">Receptionist 1</span>
                      <span className="font-medium text-slate-700">{doctor.receptionist1Name} ({doctor.receptionist1Phone})</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {weeklySchedule && (
              <Card className="rounded-2xl border-none shadow-sm bg-white">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-3">
                  <div className="h-10 w-10 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-700">Clinic Timings</CardTitle>
                    <CardDescription className="text-[10px]">Weekly active hours and limits</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Daily Token Limit</span>
                      <span className="font-bold text-slate-800">{doctor.dailyTokenLimit} patients</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Consultation Fee</span>
                      <span className="font-bold text-[#4E9B5A]">₹{doctor.consultationFee}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-50 pt-3 space-y-1">
                    <span className="text-slate-400 block mb-1">Active Days</span>
                    {Object.entries(weeklySchedule).map(([day, val]: [string, any]) => (
                      val.isActive && (
                        <div key={day} className="flex justify-between py-1 border-b border-slate-50 last:border-none">
                          <span className="font-semibold text-slate-700">{day}</span>
                          <span className="text-slate-500 font-medium">{val.startTime} to {val.endTime}</span>
                        </div>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Pane: Uploaded Documents Preview */}
          <div className="flex flex-col h-full space-y-6">
            <Card className="rounded-2xl border-none shadow-sm bg-white flex-1 flex flex-col overflow-hidden">
              <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-3">
                <div className="h-10 w-10 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">Uploaded Certificates & ID Proofs</CardTitle>
                  <CardDescription className="text-[10px]">Verify registration documents side-by-side</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-1 overflow-y-auto space-y-4">
                {doctor.documents && doctor.documents.length > 0 ? (
                  doctor.documents.map((docUrl: string, index: number) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700">Document #{index + 1}</span>
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1B3F6B] hover:text-[#1B3F6B]/90 font-bold flex items-center gap-1"
                        >
                          Open in Tab <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="h-48 w-full bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-mono overflow-hidden">
                        {docUrl.endsWith(".pdf") ? (
                          <div className="text-center p-4">
                            <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                            <span>PDF Document uploaded</span>
                          </div>
                        ) : (
                          <img src={docUrl} alt={`Credential-${index}`} className="h-full w-full object-cover" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-slate-400 py-10">
                    No verification documents uploaded.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Verification / Rejection Action Panel */}
            <Card className="rounded-2xl border-none shadow-md bg-white">
              <CardContent className="p-6 space-y-4">
                {!showRejectInput ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="reviewNote" className="text-slate-600 text-xs">
                        Manual Verification Note (Required for approval)
                      </Label>
                      <textarea
                        id="reviewNote"
                        placeholder="Verify qualification, registration certificate check and credentials confirmation..."
                        rows={2}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction("APPROVE")}
                        disabled={submitting}
                        className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl flex-1 py-6 font-semibold"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Approve & Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowRejectInput(true)}
                        disabled={submitting}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl flex-1 py-6 font-semibold"
                      >
                        Reject Request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rejectReason" className="text-red-600 text-xs font-semibold">
                        Rejection Explanation (Will be shown to the doctor)
                      </Label>
                      <textarea
                        id="rejectReason"
                        placeholder="Provide details (e.g. invalid medical registration number, blurry documents)..."
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full mt-1 p-3 rounded-xl border border-red-200 text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction("REJECT")}
                        disabled={submitting}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl flex-1 py-6 font-semibold"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm Rejection"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowRejectInput(false)}
                        disabled={submitting}
                        className="text-slate-500 rounded-xl flex-1 py-6 font-semibold"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
