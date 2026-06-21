"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, MapPin, SlidersHorizontal, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import DoctorCard from "@/components/shared/DoctorCard";
import SpecialitySelect from "@/components/shared/SpecialitySelect";

export default function SearchPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface-primary">Loading search portal...</div>}>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search parameters
  const initialQ = searchParams.get("q") || "";
  const initialDistrict = searchParams.get("district") || "Jamui";
  const initialSpeciality = searchParams.get("speciality") || "";

  // State
  const [q, setQ] = useState(initialQ);
  const [district, setDistrict] = useState(initialDistrict);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [feeRange, setFeeRange] = useState<string>("");
  const [gender, setGender] = useState<string>("Any");
  const [language, setLanguage] = useState<string>("");
  const [availableToday, setAvailableToday] = useState<boolean>(false);
  const [emergencyOnly, setEmergencyOnly] = useState<boolean>(false);

  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Forms for Empty States
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestPhone, setRequestPhone] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestSpeciality, setRequestSpeciality] = useState(initialSpeciality || "General Physician");
  const [requestLoading, setRequestLoading] = useState(false);

  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Sync district with Header cookie
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const districtCookie = cookies.find((row) => row.startsWith("jvc_district="));
    if (districtCookie) {
      setDistrict(decodeURIComponent(districtCookie.split("=")[1]));
    }
  }, [searchParams]);

  // Execute search fetch
  const executeSearch = () => {
    setLoading(true);
    const params = new URLSearchParams({
      district,
      q,
      page: "1",
    });

    if (speciality) params.set("speciality", speciality);
    if (feeRange) params.set("feeRange", feeRange);
    if (gender && gender !== "Any") params.set("gender", gender);
    if (language) params.set("language", language);
    if (availableToday) params.set("availableToday", "true");
    if (emergencyOnly) params.set("emergencyOnly", "true");

    // Grab user location if available in browser
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          params.set("lat", pos.coords.latitude.toString());
          params.set("lng", pos.coords.longitude.toString());
          fetchResults(params);
        },
        () => {
          fetchResults(params);
        }
      );
    } else {
      fetchResults(params);
    }
  };

  const fetchResults = (params: URLSearchParams) => {
    fetch(`/api/public/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setResults(data.data.results || []);
          setTotalCount(data.data.totalCount || 0);
        }
      })
      .catch((err) => console.error("Search failed:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    executeSearch();
  }, [district, searchParams, speciality, feeRange, gender, language, availableToday, emergencyOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length === 1) return;
    
    // Update URL query parameters
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    router.push(url.pathname + url.search);
  };

  const clearAllFilters = () => {
    setSpeciality("");
    setFeeRange("");
    setGender("Any");
    setLanguage("");
    setAvailableToday(false);
    setEmergencyOnly(false);
    setQ("");
    router.push(`/search?district=${district}`);
  };

  // Submit Lead Capture: Variant 1 Empty State (Query no results)
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+91[6-9]\d{9}$/.test(requestPhone)) {
      alert("Please enter a valid 10-digit Indian mobile number prefixed with +91");
      return;
    }
    setRequestLoading(true);
    try {
      const res = await fetch("/api/patient/doctor-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: requestName || "Anonymous Request",
          phone: requestPhone,
          district,
          speciality: requestSpeciality,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRequestSubmitted(true);
      } else {
        alert(data.error || "Failed to submit request.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRequestLoading(false);
    }
  };

  // Submit Waitlist: Variant 3 Empty State (No doctors in district)
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+91[6-9]\d{9}$/.test(waitlistPhone)) {
      alert("Please enter a valid 10-digit Indian mobile number prefixed with +91");
      return;
    }
    setWaitlistLoading(true);
    try {
      // Find a doctor in the database for the joinWaitlist endpoint, or if none, submit to general list
      const res = await fetch("/api/patient/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: "00000000-0000-0000-0000-000000000000", // General waitlist placeholder
          phone: waitlistPhone,
          name: waitlistName || "General Area Waitlist",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWaitlistSubmitted(true);
      } else {
        alert(data.error || "Failed to join waitlist.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaitlistLoading(false);
    }
  };

  // Determine empty state layout variant
  const isFiltersActive = speciality || feeRange || gender !== "Any" || language || availableToday || emergencyOnly;
  const isNoResults = results.length === 0;

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />

      <div className="container mx-auto max-w-4xl px-4 py-6 md:py-10 flex flex-col gap-6">
        
        {/* Search header & Input */}
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-content-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search symptom or doctor name..."
                className="pl-9 h-10 bg-surface-card border-border text-sm md:text-base"
              />
            </div>
            <Button type="submit" className="bg-brand-blue hover:bg-brand-blue-hover text-white h-10">
              Search
            </Button>
          </form>

          {/* Filters toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-content-secondary">
              {loading ? "Searching..." : `${totalCount} verified doctors found in ${district}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 border-border"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters {isFiltersActive && "●"}
            </Button>
          </div>
        </div>

        {/* Collapsible Filters Panel */}
        {showFilters && (
          <div className="bg-surface-card border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Speciality Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase">Speciality</label>
              <SpecialitySelect selected={speciality} onChange={setSpeciality} />
            </div>

            {/* Fee Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase">Fee</label>
              <select
                value={feeRange}
                onChange={(e) => setFeeRange(e.target.value)}
                className="w-full bg-surface-card border border-border px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-content-primary"
              >
                <option value="">Any Price</option>
                <option value="Under 200">Under ₹200</option>
                <option value="200-500">₹200 - ₹500</option>
                <option value="500+">₹500+</option>
              </select>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase">Doctor Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-surface-card border border-border px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-content-primary"
              >
                <option value="Any">Any Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Language */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-surface-card border border-border px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-content-primary"
              >
                <option value="">Any Language</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Bhojpuri">Bhojpuri</option>
                <option value="Maithili">Maithili</option>
              </select>
            </div>

            {/* Toggle Toggles */}
            <div className="flex items-center gap-4 sm:col-span-2 md:col-span-1 py-2">
              <label className="flex items-center gap-2 text-sm text-content-primary font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableToday}
                  onChange={(e) => setAvailableToday(e.target.checked)}
                  className="rounded text-brand-blue focus:ring-brand-blue/30 w-4 h-4"
                />
                Available Today
              </label>

              <label className="flex items-center gap-2 text-sm text-content-primary font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={emergencyOnly}
                  onChange={(e) => setEmergencyOnly(e.target.checked)}
                  className="rounded text-brand-blue focus:ring-brand-blue/30 w-4 h-4"
                />
                Emergency
              </label>
            </div>

            {/* Clear All Filters Button */}
            {isFiltersActive && (
              <div className="flex items-end justify-end md:col-span-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-status-error hover:bg-status-error/5 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="h-40 bg-surface-card border border-border rounded-xl" />
              <div className="h-40 bg-surface-card border border-border rounded-xl" />
            </div>
          ) : isNoResults ? (
            <>
              {/* Variant 2: Filters Too Tight */}
              {isFiltersActive ? (
                <div className="bg-surface-card border border-border rounded-xl p-8 text-center flex flex-col items-center gap-4">
                  <AlertCircle className="w-12 h-12 text-content-muted" />
                  <h3 className="text-lg font-semibold text-content-primary">
                    No doctors match these filters
                  </h3>
                  <p className="text-sm text-content-secondary max-w-xs leading-relaxed">
                    Try removing or resetting some of your search filters to see more results.
                  </p>
                  <Button onClick={clearAllFilters} className="bg-brand-blue hover:bg-brand-blue-hover text-white">
                    Clear Filters
                  </Button>
                </div>
              ) : q.trim().length >= 2 ? (
                /* Variant 1: Query No Results - Request Doctor Form */
                <div className="bg-surface-card border border-border rounded-xl p-6 md:p-8 flex flex-col gap-4">
                  <div className="text-center flex flex-col items-center gap-2">
                    <AlertCircle className="w-12 h-12 text-status-warning" />
                    <h3 className="text-lg font-semibold text-content-primary">
                      No doctors found for &ldquo;{q}&rdquo; in {district}
                    </h3>
                    <p className="text-sm text-content-secondary max-w-sm leading-relaxed">
                      We are currently onboarding doctors in this area. Request your doctor, and we will contact them to join our platform.
                    </p>
                  </div>

                  {requestSubmitted ? (
                    <div className="bg-brand-green/10 border border-brand-green/20 text-brand-green p-4 rounded-lg text-center text-sm font-semibold">
                      Thank you! Your request has been registered. We are working hard to onboard doctors in your area.
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-content-secondary">Doctor / Clinic Name</label>
                        <Input
                          value={requestName}
                          onChange={(e) => setRequestName(e.target.value)}
                          placeholder="e.g. Dr. Kumar"
                          required
                          className="border-border text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-content-secondary">Your Phone Number</label>
                        <Input
                          value={requestPhone}
                          onChange={(e) => setRequestPhone(e.target.value)}
                          placeholder="e.g. +919876543210"
                          required
                          className="border-border text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-content-secondary">Speciality Needed</label>
                        <SpecialitySelect selected={requestSpeciality} onChange={setRequestSpeciality} />
                      </div>
                      <Button
                        type="submit"
                        disabled={requestLoading}
                        className="bg-brand-blue hover:bg-brand-blue-hover text-white sm:col-span-2 mt-2"
                      >
                        {requestLoading ? "Submitting..." : "Submit Request"}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                /* Variant 3: Area No Doctors Yet - Notify Me Box */
                <div className="bg-surface-card border border-border rounded-xl p-6 md:p-8 flex flex-col gap-4">
                  <div className="text-center flex flex-col items-center gap-2">
                    <MapPin className="w-12 h-12 text-brand-blue" />
                    <h3 className="text-lg font-semibold text-content-primary">
                      Doctors are joining soon in {district}
                    </h3>
                    <p className="text-sm text-content-secondary max-w-sm leading-relaxed">
                      JivniCare same-day appointment tokens are expanding. Register your phone number to get notified immediately when the service launches here.
                    </p>
                  </div>

                  {waitlistSubmitted ? (
                    <div className="bg-brand-green/10 border border-brand-green/20 text-brand-green p-4 rounded-lg text-center text-sm font-semibold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>You will be notified immediately when JivniCare expands to {district}!</span>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="flex flex-col sm:flex-row gap-3 mt-2">
                      <Input
                        value={waitlistName}
                        onChange={(e) => setWaitlistName(e.target.value)}
                        placeholder="Your Name (e.g. Ramesh)"
                        className="border-border text-sm"
                      />
                      <Input
                        value={waitlistPhone}
                        onChange={(e) => setWaitlistPhone(e.target.value)}
                        placeholder="Your Phone (e.g. +919876543210)"
                        required
                        className="border-border text-sm"
                      />
                      <Button
                        type="submit"
                        disabled={waitlistLoading}
                        className="bg-brand-blue hover:bg-brand-blue-hover text-white px-8"
                      >
                        {waitlistLoading ? "Joining..." : "Get Notified"}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            results.map((doc) => <DoctorCard key={doc.id} doctor={doc} />)
          )}
        </div>

      </div>

      <Footer />
    </div>
  );
}
