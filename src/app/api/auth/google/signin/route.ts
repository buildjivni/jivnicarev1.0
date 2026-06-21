import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const nextUrl = request.nextUrl;
  const mockRole = nextUrl.searchParams.get("mockRole") || "admin";

  // Development mock login fallback if credentials are missing
  if (process.env.NODE_ENV === "production") {
    if (!clientId) {
      return NextResponse.redirect(new URL("/login?error=missing_client_id", nextUrl.origin));
    }
  } else {
    // In development/test, fallback to mock login if CLIENT_ID is missing or requested
    const devRedirectUrl = new URL("/api/auth/google/callback", nextUrl.origin);
    devRedirectUrl.searchParams.set("code", `mock_code_${mockRole}`);
    return NextResponse.redirect(devRedirectUrl);
  }

  const redirectUri = `${nextUrl.origin}/api/auth/google/callback`;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(
    "openid email profile"
  )}&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}
