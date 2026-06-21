import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/utils/auth";

const PUBLIC = [
  "/",
  "/login",
  "/otp",
  "/search",
  "/doctors",
  "/api/public",
  "/api/auth", // Allows all callback/signin routes and OTP endpoints
  "/api/health",
  "/api/patient/doctor-request",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC.some((p) => p === "/" ? pathname === "/" : pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get("jvc_session")?.value;
  const session = token ? await verifyJWT(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 1. Guard for Doctor pending Google link
  if (session.role === "DOCTOR_PENDING_GOOGLE_LINK") {
    if (
      pathname !== "/doctor/register" &&
      !pathname.startsWith("/api/auth") &&
      pathname !== "/api/doctor/register"
    ) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/doctor/register", request.url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // 2. Guard for Admin pending MFA
  if (session.role === "ADMIN_PENDING_MFA") {
    if (pathname !== "/admin/totp" && !pathname.startsWith("/api/auth")) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/admin/totp", request.url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // Redirect fully authenticated Admin away from TOTP setup/verify page
  if (session.role === "ADMIN" && pathname === "/admin/totp") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Role guards
  const isAdmin = session.role === "ADMIN";
  const isDoctor = session.role === "DOCTOR";

  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    !isAdmin
  ) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    (pathname.startsWith("/doctor") || pathname.startsWith("/api/doctor")) &&
    !isDoctor &&
    !isAdmin &&
    pathname !== "/doctor/register" &&
    pathname !== "/api/doctor/register"
  ) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/login", request.url));
  }

  return addSecurityHeaders(NextResponse.next());
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
