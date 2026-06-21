"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  ChevronLeft,
  Loader2,
  Download,
  Edit2,
  Save,
  X,
  Calendar,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // PDF Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  // Inline notes editing
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  const fetchPatients = async (p = page) => {
    setLoading(true);
    try {
      const url = new URL("/api/doctor/patients", window.location.origin);
      url.searchParams.set("page", p.toString());
      url.searchParams.set("limit", "10");
      if (searchQuery.trim()) {
        url.searchParams.set("search", searchQuery.trim());
      }
      if (fromStr) {
        url.searchParams.set("from", fromStr);
      }
      if (toStr) {
        url.searchParams.set("to", toStr);
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load patient history");

      setPatients(data.data.patients || []);
      setTotalPages(data.data.totalPages || 1);
      setPage(p);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Authenticate and fetch
    const checkAuth = async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      fetchPatients(1);
    };
    checkAuth();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(1);
  };

  const handleExportPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportFrom || !exportTo) {
      toast.error("Please select both start and end dates.");
      return;
    }

    const start = new Date(exportFrom);
    const end = new Date(exportTo);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 31) {
      toast.error("Date range cannot exceed 31 days as per PRD constraints.");
      return;
    }

    setExporting(true);
    toast.loading("Generating your branded patient history PDF...");

    try {
      const url = `/api/doctor/export?from=${exportFrom}&to=${exportTo}`;
      window.open(url, "_blank");
      toast.dismiss();
      toast.success("PDF export complete!");
      setExportOpen(false);
    } catch (err) {
      toast.dismiss();
      toast.error("Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleStartEditing = (token: any) => {
    setEditingTokenId(token.id);
    setEditingNotesText(token.internalNotes || "");
  };

  const handleCancelEditing = () => {
    setEditingTokenId(null);
    setEditingNotesText("");
  };

  const handleSaveNotes = async (tokenId: string) => {
    setSavingNotesId(tokenId);
    try {
      const res = await fetch(`/api/doctor/tokens/${tokenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: editingNotesText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notes");

      toast.success("Notes updated successfully!");
      setPatients((prev) =>
        prev.map((p) => (p.id === tokenId ? { ...p, internalNotes: editingNotesText } : p))
      );
      setEditingTokenId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingNotesId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => router.push("/doctor/dashboard")}
              className="rounded-full h-10 w-10 p-0 hover:bg-slate-100 flex items-center justify-center text-[#1B3F6B]"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1B3F6B] flex items-center gap-2">
                <Users className="h-6 w-6" /> Patient Consultation History
              </h1>
              <p className="text-xs text-slate-400">Search past visits, edit internal notes, and export PDF data</p>
            </div>
          </div>

          <Button
            onClick={() => setExportOpen(true)}
            className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl gap-2 font-semibold text-xs"
          >
            <Download className="h-4 w-4" /> Export PDF (Max 31 Days)
          </Button>
        </div>

        {/* Filter and Search Card */}
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full space-y-1">
                <Label htmlFor="search" className="text-slate-600 text-xs font-semibold">Search Patients</Label>
                <div className="relative">
                  <Input
                    id="search"
                    placeholder="Search by Patient Name or Phone Number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl border-slate-200 pl-10"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="w-full md:w-44 space-y-1">
                <Label htmlFor="from" className="text-slate-600 text-xs font-semibold">From Date</Label>
                <Input
                  id="from"
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="w-full md:w-44 space-y-1">
                <Label htmlFor="to" className="text-slate-600 text-xs font-semibold">To Date</Label>
                <Input
                  id="to"
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  type="submit"
                  className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl font-semibold text-xs px-6 py-5 flex-1 md:flex-initial"
                >
                  Apply Filters
                </Button>
                {(searchQuery || fromStr || toStr) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery("");
                      setFromStr("");
                      setToStr("");
                      setTimeout(() => fetchPatients(1), 50);
                    }}
                    className="rounded-xl text-slate-500 text-xs hover:bg-slate-100"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Patients Table Card */}
        <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="py-4 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-700">Patient Records List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#1B3F6B] mb-2" />
                <p className="text-xs text-slate-400">Loading history records...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                No patient history records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Address</th>
                      <th className="py-3 px-4">Type/Token</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 min-w-[200px]">Internal Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {patients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 whitespace-nowrap">
                          {new Date(patient.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-800">{patient.name}</td>
                        <td className="py-4 px-4 whitespace-nowrap">{patient.phone}</td>
                        <td className="py-4 px-4">{patient.address}</td>
                        <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-600">
                          {patient.type === "WALKIN" ? "Walk-in" : "Online"} #{patient.tokenNumber}
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            className={`font-semibold border-none rounded-lg text-[9px] uppercase px-2 py-0.5 ${
                              patient.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                : patient.status === "NO_SHOW"
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-50"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {patient.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          {editingTokenId === patient.id ? (
                            <textarea
                              value={editingNotesText}
                              onChange={(e) => setEditingNotesText(e.target.value)}
                              rows={2}
                              className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#1B3F6B] focus:border-[#1B3F6B] resize-none"
                              placeholder="Add follow-up notes, prescriptions, etc."
                            />
                          ) : (
                            <span className="text-slate-500 italic block max-w-xs truncate">
                              {patient.internalNotes || "No notes saved"}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {editingTokenId === patient.id ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleSaveNotes(patient.id)}
                                disabled={savingNotesId === patient.id}
                                className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-lg px-2 h-7"
                              >
                                {savingNotesId === patient.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEditing}
                                className="text-slate-400 hover:bg-slate-100 rounded-lg px-2 h-7"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditing(patient)}
                              className="text-[#1B3F6B] hover:bg-[#1B3F6B]/5 rounded-lg px-2.5 h-7 gap-1"
                            >
                              <Edit2 className="h-3 w-3" /> Edit Notes
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => fetchPatients(page - 1)}
                className="rounded-lg h-8 border-slate-200 text-slate-600 gap-1.5"
              >
                <PrevIcon className="h-3.5 w-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => fetchPatients(page + 1)}
                className="rounded-lg h-8 border-slate-200 text-slate-600 gap-1.5"
              >
                Next <NextIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B3F6B]">Export Consultation PDF</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExportPDF} className="space-y-4 pt-2">
            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-start gap-2">
              <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 leading-normal">
                Select a date range of up to 31 days to export a branded PDF list of all patient consultations and receptionist walk-ins.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="exportFrom" className="text-slate-600 text-xs font-semibold">Start Date</Label>
                <Input
                  id="exportFrom"
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="rounded-xl border-slate-200"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="exportTo" className="text-slate-600 text-xs font-semibold">End Date</Label>
                <Input
                  id="exportTo"
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="rounded-xl border-slate-200"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExportOpen(false)}
                className="rounded-xl text-slate-500 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={exporting}
                className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl text-xs font-semibold px-6"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Export PDF"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
