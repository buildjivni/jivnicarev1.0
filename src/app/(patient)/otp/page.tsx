"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import Turnstile from "@/components/shared/Turnstile";
import toast, { Toaster } from "react-hot-toast";

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const redirect = searchParams.get("redirect") || "";

  // 6-digit OTP state (array of strings)
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & loading states
  const [cooldown, setCooldown] = useState<number>(25);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [resendToken, setResendToken] = useState<string>("");

  // Redirect to login if phone is missing
  useEffect(() => {
    if (!phone) {
      router.replace("/login");
    }
  }, [phone, router]);

  // Countdown timer logic
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Masked phone format (e.g., +91 ******4321)
  const maskPhone = (num: string) => {
    if (num.length < 10) return num;
    return `${num.slice(0, 3)} ****** ${num.slice(-4)}`;
  };

  // Keyboard navigation & auto-focus
  const handleChange = (value: string, index: number) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (!numericValue) return;

    const newOtp = [...otp];
    // Keep only the last character typed
    newOtp[index] = numericValue.slice(-1);
    setOtp(newOtp);

    // Auto focus next input
    if (index < 5 && newOtp[index]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Focus previous input if current is empty
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const digits = pastedData.replace(/[^0-9]/g, "").slice(0, 6);

    if (digits.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || "";
      }
      setOtp(newOtp);

      // Focus last populated input or first empty
      const targetIndex = Math.min(digits.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  // Trigger auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.every((digit) => digit !== "")) {
      handleVerify(otp.join(""));
    }
  }, [otp]);

  // Verify OTP submission
  const handleVerify = async (code: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: code }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Authentication successful!");
        // Small delay to let toast render
        setTimeout(() => {
          router.replace(redirect || "/");
          router.refresh();
        }, 800);
      } else {
        toast.error(data.error || "Invalid OTP code. Please check and try again.");
        // Clear input and focus first box on failure
        setOtp(new Array(6).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error(err);
      toast.error("Verification failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP trigger
  const handleResend = async () => {
    if (cooldown > 0) return;
    if (!resendToken) {
      toast.error("Please complete the security check to resend the code.");
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, turnstileToken: resendToken }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Verification code resent!");
        setCooldown(25);
        setOtp(new Array(6).fill(""));
        setResendToken(""); // Clear token for next time
      } else {
        toast.error(data.error || "Failed to resend code.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resending code. Please check connection.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface-card border border-border shadow-lg rounded-2xl p-6 md:p-8 flex flex-col gap-6">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center mb-1">
          <KeyRound className="w-6 h-6 text-brand-blue" />
        </div>
        <h1 className="text-2xl font-display font-bold text-content-primary">
          Enter Verification Code
        </h1>
        <p className="text-sm text-content-secondary">
          We sent a 6-digit verification code to
          <span className="block font-semibold text-content-primary mt-1 font-mono">
            {maskPhone(phone)}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* 6-Digit Segmented Numeric Box Input */}
        <div className="flex justify-between gap-2 max-w-xs mx-auto">
          {otp.map((digit, index) => (
            <input
              key={index}
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={loading}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={handlePaste}
              className="w-11 h-12 text-center text-xl font-display font-bold bg-surface-primary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 text-content-primary shadow-sm"
            />
          ))}
        </div>

        {/* Verification Button */}
        <Button
          onClick={() => handleVerify(otp.join(""))}
          disabled={loading || otp.some((d) => d === "")}
          className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold py-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Verify and Login</span>
            </>
          )}
        </Button>

        {/* Resend Cooldown Section */}
        <div className="flex flex-col items-center gap-4 pt-2 border-t border-border/60">
          {cooldown > 0 ? (
            <p className="text-xs text-content-secondary font-medium">
              Resend code in <span className="text-brand-blue font-semibold">{cooldown}s</span>
            </p>
          ) : (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Solve Turnstile to get resend token */}
              {!resendToken && (
                <div className="w-full text-center">
                  <p className="text-xs text-content-muted mb-1">
                    Complete security check to enable resend button
                  </p>
                  <Turnstile
                    onSuccess={(token) => setResendToken(token)}
                    onError={() => toast.error("Verification failed.")}
                  />
                </div>
              )}

              <button
                onClick={handleResend}
                disabled={resending || !resendToken}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>Resend Verification Code</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientOtpPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />
      <Toaster position="top-center" />

      <main className="flex-1 flex items-center justify-center p-4 py-12 md:py-20">
        <Suspense
          fallback={
            <div className="w-full max-w-md bg-surface-card border border-border shadow-lg rounded-2xl p-6 md:p-8 flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                <span className="text-sm text-content-secondary font-medium">Loading authentication modules...</span>
              </div>
            </div>
          }
        >
          <OtpForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
