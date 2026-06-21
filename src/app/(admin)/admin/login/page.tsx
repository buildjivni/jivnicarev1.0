"use client";

import React, { useState } from "react";
import { Shield, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [mockLoading, setMockLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID";
    const redirectUri = typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google/callback`
      : "";
    
    // Redirect to Google OAuth consent screen
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile%20openid`;
    window.location.href = googleAuthUrl;
  };

  const handleMockLogin = () => {
    setMockLoading(true);
    // In dev mode, we redirect to callback with a mock code parameter
    window.location.href = `/api/auth/google/callback?code=mock_code_admin`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg rounded-2xl border-none">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B] mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#1B3F6B]">JivniCare Admin Portal</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Sign in to access the JivniCare Command Center
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading || mockLoading}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl gap-2 font-semibold py-6 shadow-sm"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : (
              <Globe className="h-5 w-5 text-red-500" />
            )}
            Sign in with Google OAuth
          </Button>

          {/* Development / Mock Login Trigger */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-center text-slate-400 font-semibold uppercase tracking-wider">
              Offline / Development Mode
            </p>
            <Button
              variant="outline"
              onClick={handleMockLogin}
              disabled={loading || mockLoading}
              className="w-full border-dashed border-[#1B3F6B]/30 text-[#1B3F6B] hover:bg-[#1B3F6B]/5 rounded-xl text-xs font-semibold py-5"
            >
              {mockLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Bypass Google OAuth (Mock Admin)"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
