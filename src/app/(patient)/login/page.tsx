"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, ShieldCheck, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import Turnstile from "@/components/shared/Turnstile";
import toast, { Toaster } from "react-hot-toast";

// Schema for 10-digit Indian phone validation (UI-level)
const loginFormSchema = z.object({
  phoneDigits: z
    .string()
    .length(10, "Phone number must be exactly 10 digits")
    .regex(/^[6-9]\d{9}$/, "Must start with 6, 7, 8, or 9"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";

  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    if (!turnstileToken) {
      toast.error("Please complete the security check.");
      return;
    }

    setLoading(true);
    const fullPhone = `+91${values.phoneDigits}`;

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: fullPhone,
          turnstileToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("OTP sent successfully!");
        router.push(
          `/otp?phone=${encodeURIComponent(fullPhone)}&redirect=${encodeURIComponent(
            redirect
          )}`
        );
      } else {
        toast.error(data.error || "Failed to send OTP. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface-card border border-border shadow-lg rounded-2xl p-6 md:p-8 flex flex-col gap-6">
      {/* Header section with brand colors */}
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center mb-1">
          <Activity className="w-6 h-6 text-brand-blue animate-pulse" />
        </div>
        <h1 className="text-2xl font-display font-bold text-content-primary">
          Verify Your Phone
        </h1>
        <p className="text-sm text-content-secondary max-w-xs">
          Verify your mobile number to instantly book same-day doctor checkup tokens.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Input field with +91 locked prefix */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phoneDigits" className="text-xs font-semibold text-content-secondary">
            Mobile Number
          </label>
          <div className="flex rounded-xl border border-border bg-surface-primary focus-within:ring-2 focus-within:ring-brand-blue transition-all duration-200 overflow-hidden">
            <span className="flex items-center justify-center px-3.5 bg-disabled-bg border-r border-border text-sm font-semibold text-content-secondary select-none">
              +91
            </span>
            <div className="flex-1 flex items-center px-3 gap-2">
              <Phone className="w-4 h-4 text-content-muted" />
              <input
                type="tel"
                id="phoneDigits"
                autoFocus
                placeholder="Enter 10-digit number"
                className="w-full bg-transparent text-sm md:text-base focus:outline-none placeholder-content-muted text-content-primary py-3"
                disabled={loading}
                {...register("phoneDigits")}
              />
            </div>
          </div>
          {errors.phoneDigits && (
            <p className="text-xs text-status-error font-medium mt-0.5">
              {errors.phoneDigits.message}
            </p>
          )}
        </div>

        {/* Turnstile Widget */}
        <Turnstile
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => toast.error("Security challenge failed. Please reload.")}
          onExpire={() => {
            setTurnstileToken("");
            toast.error("Security challenge expired. Please solve again.");
          }}
        />

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || !turnstileToken}
          className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold py-6 rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Get Verification Code</span>
            </>
          )}
        </Button>
      </form>

      {/* Trusted Badges */}
      <div className="flex items-center justify-center gap-6 border-t border-border/60 pt-4 mt-2">
        <span className="text-[11px] text-content-muted flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> Verified clinics only
        </span>
        <span className="text-[11px] text-content-muted flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> 100% Secure database
        </span>
      </div>

      <div className="text-center pt-2 mt-1 border-t border-border/60">
        <span className="text-xs text-content-secondary">
          Are you a clinic partner?{" "}
          <a
            href="/api/auth/google/signin?mockRole=doctor"
            className="text-brand-blue hover:underline font-semibold"
          >
            Doctor Login
          </a>
        </span>
      </div>
    </div>
  );
}

export default function PatientLoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />
      <Toaster position="top-center" reverseOrder={false} />

      <main className="flex-1 flex items-center justify-center p-4 py-12 md:py-20">
        <Suspense
          fallback={
            <div className="w-full max-w-md bg-surface-card border border-border shadow-lg rounded-2xl p-6 md:p-8 flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                <span className="text-sm text-content-secondary font-medium">Loading security modules...</span>
              </div>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
