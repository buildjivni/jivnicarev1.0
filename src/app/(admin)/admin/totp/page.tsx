"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, AlertCircle, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

export default function AdminTotpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [setupData, setSetupData] = useState<any>(null);
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Backup code login mode
  const [useBackupMode, setUseBackupMode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [checkboxTicked, setCheckboxTicked] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Fetch temp session
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/admin/login");
          return;
        }
        // Fetch setup config. If it returns 400 with "already configured", then totp is enabled.
        const setupRes = await fetch("/api/auth/setup-totp");
        if (setupRes.ok) {
          const sData = await setupRes.json();
          setSetupData(sData.data);
          setIsSetup(true);
        } else {
          // Already enabled, standard login
          setIsSetup(false);
        }
      } catch (err) {
        console.error("MFA Init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) {
      toast.error("Please enter a 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify code");

      toast.success("Verification successful!");

      if (data.data.backupCodes) {
        // Show backup codes for first-time setup
        setBackupCodes(data.data.backupCodes);
        setShowBackupCodes(true);
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCodeInput.trim() || backupCodeInput.length !== 8) {
      toast.error("Please enter a valid 8-character backup code.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: backupCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify backup code");

      toast.success("Backup code accepted!");
      router.push("/admin");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Backup codes copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const text = backupCodes.join("\n");
    const blob = new Blob([`JIVNICARE ADMIN BACKUP CODES\nGenerated: ${new Date().toLocaleString()}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jivnicare-backup-codes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading security verification...</p>
      </div>
    );
  }

  // Display backup codes modal-screen on first setup
  if (showBackupCodes) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg rounded-2xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-[#4E9B5A] mb-4">
              <Check className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-[#1B3F6B]">Save Backup Codes</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Save these recovery backup codes in a safe place. They will not be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-100 rounded-xl font-mono text-center text-sm font-semibold select-all text-slate-700">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-white border border-slate-200/60 rounded-lg">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopyCodes}
                className="flex-1 rounded-xl gap-2 font-semibold text-xs py-5"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Codes
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadCodes}
                className="flex-1 rounded-xl gap-2 font-semibold text-xs py-5"
              >
                <Download className="h-4 w-4" />
                Download TXT
              </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Save these codes. They are shown ONLY once and cannot be recovered.</span>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input
                id="save-confirm-checkbox"
                type="checkbox"
                checked={checkboxTicked}
                onChange={(e) => setCheckboxTicked(e.target.checked)}
                className="h-4 w-4 accent-[#1B3F6B] rounded border-slate-300"
              />
              <Label htmlFor="save-confirm-checkbox" className="text-xs text-slate-600 font-semibold cursor-pointer select-none">
                I have saved my backup codes securely.
              </Label>
            </div>

            <Button
              onClick={() => router.push("/admin")}
              disabled={!checkboxTicked}
              className="w-full bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl py-6 font-semibold disabled:opacity-50"
            >
              Proceed to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg rounded-2xl border-none bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B] mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-[#1B3F6B]">
            {isSetup ? "Configure Two-Factor MFA" : "Two-Factor Verification"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {isSetup
              ? "Scan the QR code below using Google Authenticator to get OTP codes"
              : "Enter the 6-digit code from Google Authenticator to log in"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* SETUP SCREEN: SHOW QR CODE */}
          {isSetup && setupData && (
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <QRCodeSVG value={setupData.qrCodeUri} size={160} />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Secret Key (Manual Entry)
                </span>
                <span className="font-mono text-sm text-[#1B3F6B] font-bold select-all tracking-wider mt-1 block">
                  {setupData.secret}
                </span>
              </div>
            </div>
          )}

          {/* VERIFY FORM */}
          {!useBackupMode ? (
            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <div>
                <Label htmlFor="totp" className="text-slate-600 text-xs">
                  6-Digit Authenticator Code
                </Label>
                <Input
                  id="totp"
                  placeholder="000000"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl border-slate-200 text-center tracking-widest text-lg font-bold mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={verifying}
                className="w-full bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl py-6 font-semibold"
              >
                {verifying ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Verify Code"}
              </Button>

              {!isSetup && (
                <button
                  type="button"
                  onClick={() => setUseBackupMode(true)}
                  className="w-full text-center text-xs text-slate-500 hover:text-[#1B3F6B] font-semibold mt-2 block"
                >
                  Lost device? Use backup recovery code
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyBackup} className="space-y-4">
              <div>
                <Label htmlFor="backup" className="text-slate-600 text-xs">
                  8-Character Backup Code
                </Label>
                <Input
                  id="backup"
                  placeholder="xxxxxxxx"
                  maxLength={8}
                  value={backupCodeInput}
                  onChange={(e) => setBackupCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  className="rounded-xl border-slate-200 text-center tracking-widest text-sm font-mono font-bold mt-1 uppercase"
                />
              </div>

              <Button
                type="submit"
                disabled={verifying}
                className="w-full bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl py-6 font-semibold"
              >
                {verifying ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Verify Backup Code"}
              </Button>

              <button
                type="button"
                onClick={() => setUseBackupMode(false)}
                className="w-full text-center text-xs text-slate-500 hover:text-[#1B3F6B] font-semibold mt-2 block"
              >
                Back to Authenticator OTP code
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
