"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Activity,
  ShieldAlert,
  Award,
  Stethoscope,
  Baby,
  HeartHandshake,
  Heart,
  Smile,
  Ear,
  Eye,
  Scissors,
  Syringe,
  Wind,
  FlaskConical,
  Filter,
  Accessibility,
  Scan,
  Brain,
  Clock,
  Users,
  CheckCircle,
  MapPin,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ArrowRight,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import DoctorCard from "@/components/shared/DoctorCard";
import { SPECIALITIES } from "@/lib/data/specialities";

// Premium mapping of medical specialities to Lucide Icon components
const SPECIALITY_ICONS: Record<string, any> = {
  "General Physician": Stethoscope,
  "Pediatrician": Baby,
  "Gynecologist": HeartHandshake,
  "Orthopedic": Activity,
  "Dentist": Smile,
  "Dermatologist": Sparkles,
  "ENT Specialist": Ear,
  "Ophthalmologist": Eye,
  "General Surgeon": Scissors,
  "Diabetologist": Syringe,
  "Cardiologist": Heart,
  "Neurologist": Brain,
  "Gastroenterologist": Activity,
  "Pulmonologist": Wind,
  "Endocrinologist": FlaskConical,
  "Urologist": Filter,
  "Nephrologist": Activity,
  "Psychiatrist": Brain,
  "Physiotherapist": Accessibility,
  "Radiologist": Scan,
};

function getSpecialityIcon(name: string) {
  return SPECIALITY_ICONS[name] || Stethoscope;
}

export default function HomePage() {
  const router = useRouter();
  const [district, setDistrict] = useState<string>("Jamui");
  const [query, setQuery] = useState<string>("bukhar"); // Default placeholder query for guidance
  const [typedQuery, setTypedQuery] = useState<string>("");
  const [featuredDoctors, setFeaturedDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAllSpecialities, setShowAllSpecialities] = useState<boolean>(false);

  // Load district from cookie on mount
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const districtCookie = cookies.find((row) => row.startsWith("jvc_district="));
    if (districtCookie) {
      setDistrict(decodeURIComponent(districtCookie.split("=")[1]));
    }
  }, []);

  // Fetch featured doctors whenever district changes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/home?district=${encodeURIComponent(district)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFeaturedDoctors(data.data.featuredDoctors || []);
        }
      })
      .catch((err) => console.error("Error fetching featured doctors:", err))
      .finally(() => setLoading(false));
  }, [district]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const searchVal = typedQuery.trim() || query;
    if (searchVal.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(searchVal)}&district=${encodeURIComponent(district)}`);
  };

  const handleSpecialityClick = (name: string) => {
    router.push(`/search?speciality=${encodeURIComponent(name)}&district=${encodeURIComponent(district)}`);
  };

  // Toggle visible specialities
  const visibleSpecialities = showAllSpecialities ? SPECIALITIES : SPECIALITIES.slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />

      {/* Hero Section — Trust-Led & Outcome-Driven */}
      <section className="relative bg-gradient-to-b from-brand-blue/8 via-brand-blue/2 to-transparent py-14 md:py-24 px-4 overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto max-w-4xl text-center flex flex-col items-center gap-6 relative z-10">
          
          {/* Subtle Live Status Indicator Badge */}
          <div className="flex items-center gap-1.5 bg-brand-blue/10 border border-brand-blue/20 text-brand-blue px-3 py-1 rounded-full text-xs font-semibold shadow-sm animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Live Queue Tracking Active
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-content-primary leading-tight max-w-3xl">
            Consult Your Doctor <br className="hidden sm:block" />
            <span className="text-brand-blue">Without the Waiting Room</span>
          </h1>

          <p className="text-base md:text-lg text-content-secondary max-w-xl leading-relaxed font-sans">
            JivniCare connects you with verified local clinics. See live queue positions, book same-day tokens, and wait comfortably at home until your turn is called.
          </p>

          {/* Core Search CTA Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full max-w-xl bg-surface-card border border-border shadow-lg p-2 rounded-xl flex items-center gap-2 mt-4 transition-all duration-300 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue"
          >
            <div className="flex-1 flex items-center gap-2 px-3">
              <Search className="w-5 h-5 text-content-muted" />
              <input
                type="text"
                value={typedQuery}
                onChange={(e) => setTypedQuery(e.target.value)}
                placeholder="Search symptom (e.g. bukhar, kamar dard) or doctor name..."
                className="w-full bg-transparent text-sm md:text-base focus:outline-none placeholder-content-muted text-content-primary py-2"
              />
            </div>
            
            <Button
              type="submit"
              className="bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-lg px-6 h-11 shrink-0"
            >
              Search
            </Button>
          </form>

          {typedQuery.trim().length === 1 && (
            <p className="text-xs text-status-warning font-medium animate-pulse">
              Please enter at least 2 characters to search
            </p>
          )}

          {/* Quick Guidance Tag */}
          <div className="text-xs text-content-muted flex items-center gap-1.5 mt-1">
            <span className="font-semibold text-content-secondary">Common searches:</span>
            <button 
              type="button" 
              onClick={() => { setTypedQuery("bukhar"); router.push(`/search?q=bukhar&district=${district}`); }}
              className="hover:text-brand-blue transition-colors underline"
            >
              Bukhar
            </button>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => { setTypedQuery("kamar dard"); router.push(`/search?q=kamar%20dard&district=${district}`); }}
              className="hover:text-brand-blue transition-colors underline"
            >
              Kamar Dard
            </button>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => { setTypedQuery("baccho ke rog"); router.push(`/search?q=baccho%20ke%20rog&district=${district}`); }}
              className="hover:text-brand-blue transition-colors underline"
            >
              Baccho ke Rog
            </button>
          </div>

        </div>
      </section>

      {/* How It Works Section — Designed for Low-Tech Comfort */}
      <section className="py-12 md:py-16 px-4 bg-surface-primary border-t border-border/60">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center flex flex-col items-center gap-2 mb-10">
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-content-primary">
              Consultation in 4 Simple Steps
            </h2>
            <p className="text-sm text-content-secondary max-w-md leading-relaxed">
              No complex forms or prepayments. We keep the process transparent, direct, and stress-free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {/* Step 1 */}
            <div className="bg-surface-card border border-border/85 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-start relative group">
              <div className="absolute top-4 right-4 text-3xl font-display font-black text-content-muted/20 group-hover:text-brand-blue/10 transition-colors">
                01
              </div>
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center mb-4">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-content-primary mb-2">Find a Clinic</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Search by symptoms or doctor name to find verified local physicians in your city.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface-card border border-border/85 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-start relative group">
              <div className="absolute top-4 right-4 text-3xl font-display font-black text-content-muted/20 group-hover:text-brand-green/10 transition-colors">
                02
              </div>
              <div className="w-10 h-10 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-content-primary mb-2">See Live Queue</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Check exact patient numbers ahead and view the estimated arrival window before you book.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface-card border border-border/85 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-start relative group">
              <div className="absolute top-4 right-4 text-3xl font-display font-black text-content-muted/20 group-hover:text-brand-blue/10 transition-colors">
                03
              </div>
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center mb-4">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-content-primary mb-2">Book Same-Day</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Secure your consultation token in 30 seconds. Pay your doctor directly at the clinic.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-surface-card border border-border/85 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-start relative group">
              <div className="absolute top-4 right-4 text-3xl font-display font-black text-content-muted/20 group-hover:text-brand-green/10 transition-colors">
                04
              </div>
              <div className="w-10 h-10 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center mb-4">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-content-primary mb-2">Track & Arrive</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Monitor token progression from home. Arrive at the clinic exactly when it is your turn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Specialities Section — Expandable Explorer with Proper Icons */}
      <section className="py-12 md:py-16 px-4 bg-surface-card border-y border-border/80">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col items-center text-center gap-1 mb-8">
            <h2 className="text-sm font-semibold text-brand-blue uppercase tracking-wider">
              Browse by Medical Category
            </h2>
            <p className="text-xs text-content-secondary">
              Select a speciality to find available clinics in your district
            </p>
          </div>
          
          {/* Expanded Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 transition-all duration-500">
            {visibleSpecialities.map((spec) => {
              const IconComponent = getSpecialityIcon(spec.name);
              return (
                <button
                  key={spec.id}
                  onClick={() => handleSpecialityClick(spec.name)}
                  className="flex flex-col items-center gap-3 bg-surface-primary hover:bg-brand-blue/5 border border-border hover:border-brand-blue/20 p-4 rounded-xl transition-all duration-200 group text-center shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-blue/5 text-brand-blue flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all duration-300">
                    <IconComponent className="w-5 h-5 transition-transform group-hover:scale-110 duration-200" />
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-content-primary group-hover:text-brand-blue transition-colors">
                    {spec.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View All / View Less Expander Toggle */}
          <div className="flex justify-center mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllSpecialities(!showAllSpecialities)}
              className="text-brand-blue hover:text-brand-blue-hover hover:bg-brand-blue/5 flex items-center gap-1.5 font-semibold text-xs py-2 px-4 rounded-full border border-brand-blue/20"
            >
              {showAllSpecialities ? (
                <>
                  Show Less Specialities <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  View All {SPECIALITIES.length} Specialities <ChevronDown className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Doctors Available Today */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-display font-semibold text-content-primary">
                Doctors Available Today
              </h2>
              <p className="text-sm text-content-secondary mt-0.5">
                Top verified practitioners offering active same-day bookings in {district}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-brand-green font-semibold bg-brand-green/10 border border-brand-green/20 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-ping" />
              Live Tracking Enabled
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : featuredDoctors.length === 0 ? (
            <div className="bg-surface-card border border-border rounded-xl p-8 text-center flex flex-col items-center gap-4">
              <ShieldAlert className="w-12 h-12 text-content-muted" />
              <h3 className="text-lg font-semibold text-content-primary">
                No active doctors in {district} today
              </h3>
              <p className="text-sm text-content-secondary max-w-xs leading-relaxed">
                Clinics are currently being verified in this district. Switch locations in the header menu or register below to get notified of launches.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {featuredDoctors.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} />
              ))}
            </div>
          )}

        </div>
      </section>

      {/* Trust & Value Proposition Badges */}
      <section className="py-12 bg-surface-primary border-t border-border/60 px-4">
        <div className="container mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="flex flex-col items-center text-center gap-3 bg-surface-card border border-border p-6 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-content-primary uppercase tracking-wider">Verified Medical Staff</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              Every practitioner profile is manually checked and verified with valid National Medical Commission (NMC) registration numbers.
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-3 bg-surface-card border border-border p-6 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-content-primary uppercase tracking-wider">Real-Time Progress</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              Monitor active token progressions from your phone. Reduce exposure times in crowded waiting lobbies and plan your travel.
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-3 bg-surface-card border border-border p-6 rounded-xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-content-primary uppercase tracking-wider">Free Platform Access</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              JivniCare adds no additional convenience charges. Booking is free, and patients pay only the standard doctor fees at the clinic.
            </p>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="w-full bg-surface-card border border-border rounded-xl p-4 md:p-5 flex flex-col md:flex-row gap-5 animate-pulse">
      <div className="w-full md:w-32 h-36 md:h-32 bg-surface-secondary rounded-lg" />
      <div className="flex-1 flex flex-col justify-between py-1 gap-4">
        <div>
          <div className="h-6 bg-surface-secondary rounded w-1/3 mb-3" />
          <div className="h-4 bg-surface-secondary rounded w-1/4 mb-2" />
          <div className="h-4 bg-surface-secondary rounded w-1/2" />
        </div>
        <div className="h-10 bg-surface-secondary rounded w-1/4 self-end" />
      </div>
    </div>
  );
}
