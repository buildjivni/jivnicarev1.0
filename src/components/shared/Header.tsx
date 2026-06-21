"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { MapPin, User, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [district, setDistrict] = useState<string>("Jamui");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Load selected district from cookie on mount
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const districtCookie = cookies.find((row) => row.startsWith("jvc_district="));
    if (districtCookie) {
      setDistrict(decodeURIComponent(districtCookie.split("=")[1]));
    } else {
      // Default to Jamui and set cookie
      document.cookie = `jvc_district=Jamui; path=/; max-age=${60 * 60 * 24 * 365}`;
    }

    // Fetch session
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setDistrict(selected);
    document.cookie = `jvc_district=${encodeURIComponent(selected)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    // If on search page, reload or push new search query
    if (pathname === "/search") {
      const url = new URL(window.location.href);
      url.searchParams.set("district", selected);
      router.push(url.pathname + url.search);
    } else {
      router.refresh();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full h-14 md:h-16 border-b border-border bg-surface-card/95 backdrop-blur shadow-sm">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Branding Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-horizontal-wordmark.png"
            alt="JivniCare Logo"
            width={130}
            height={36}
            priority
            className="w-auto h-8 object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {/* District Picker */}
          <div className="flex items-center gap-1.5 text-content-secondary bg-surface-primary px-3 py-1.5 rounded-md border border-border">
            <MapPin className="w-4 h-4 text-brand-blue" />
            <select
              value={district}
              onChange={handleDistrictChange}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="Jamui">Jamui (Bihar)</option>
              <option value="Deoghar">Deoghar (Jharkhand)</option>
            </select>
          </div>

          <Link
            href="/search"
            className={`text-sm font-medium transition-colors hover:text-brand-blue ${
              pathname.startsWith("/doctors") || pathname === "/search"
                ? "text-brand-blue font-semibold"
                : "text-content-secondary"
            }`}
          >
            Find Doctors
          </Link>
          
          {!loading && user && (
            <Link
              href={
                user.role === "ADMIN"
                  ? "/admin"
                  : user.role === "DOCTOR"
                  ? "/doctor/dashboard"
                  : "/bookings"
              }
              className={`text-sm font-medium transition-colors hover:text-brand-blue ${
                pathname.startsWith("/bookings") || pathname.startsWith("/doctor") || pathname.startsWith("/admin")
                  ? "text-brand-blue font-semibold"
                  : "text-content-secondary"
              }`}
            >
              My Dashboard
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-9 bg-surface-secondary rounded-md animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-content-secondary">
                Namaste, <strong className="text-content-primary">{user.name || "Patient"}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2 border-status-error/30 text-status-error hover:bg-status-error/5"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm" className="bg-brand-blue hover:bg-brand-blue-hover text-white gap-2">
                <User className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Actions: Hamburger Menu */}
        <div className="flex items-center gap-3 md:hidden">
          {/* Mobile District Selector */}
          <div className="flex items-center gap-1 text-content-secondary bg-surface-primary px-2.5 py-1 rounded-md border border-border text-xs">
            <MapPin className="w-3.5 h-3.5 text-brand-blue" />
            <select
              value={district}
              onChange={handleDistrictChange}
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
            >
              <option value="Jamui">Jamui</option>
              <option value="Deoghar">Deoghar</option>
            </select>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-content-primary hover:text-brand-blue p-1"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-14 left-0 w-full bg-surface-card border-b border-border shadow-lg md:hidden py-4 px-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
          <Link
            href="/search"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-medium text-content-primary hover:text-brand-blue"
          >
            Find Doctors
          </Link>
          
          {!loading && user && (
            <Link
              href={
                user.role === "ADMIN"
                  ? "/admin"
                  : user.role === "DOCTOR"
                  ? "/doctor/dashboard"
                  : "/bookings"
              }
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-content-primary hover:text-brand-blue"
            >
              My Dashboard
            </Link>
          )}

          <hr className="border-border" />

          {loading ? (
            <div className="w-full h-10 bg-surface-secondary rounded-md animate-pulse" />
          ) : user ? (
            <div className="flex flex-col gap-3">
              <span className="text-sm text-content-secondary">
                Logged in as: <strong className="text-content-primary">{user.name || user.phone || "Patient"}</strong>
              </span>
              <Button
                variant="outline"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full justify-center flex items-center gap-2 border-status-error/30 text-status-error hover:bg-status-error/5"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button
                className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white justify-center gap-2"
              >
                <User className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
