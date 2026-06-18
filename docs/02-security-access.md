# JivniCare V1.0.0 — Security & Access Control
# Document: 02-security-access.md
# Version: V1.0.0 FINAL

---

## ⚠ STRICT RULES — READ BEFORE EXECUTING

1. NEVER store JWT in localStorage, sessionStorage, or Zustand
2. NEVER expose raw error messages to frontend
3. NEVER skip rate limiting on any sensitive endpoint
4. NEVER allow admin route without TOTP verification
5. Patients authenticate via phone + OTP only. Doctors and the Admin authenticate via Google OAuth (NextAuth.js + jose for session signing). No other third-party login providers are permitted in V1.
6. NEVER log OTP values or JWT secrets anywhere
7. NEVER use raw SQL — Prisma ORM only (except JVC sequence)
8. ALL auth logic in src/lib/services/auth.service.ts ONLY
9. ALL routes protected by middleware — no self-protection
10. ASK NOTHING — execute exactly as written

---

## TECH STACK

```
JWT Library:    jose (NOT jsonwebtoken)
OTP Storage:    Upstash Redis (TTL-based)
Cookie:         httpOnly, secure, sameSite=strict
Admin 2FA:      TOTP via otpauth library
Rate Limiting:  @upstash/ratelimit
Input Valid:    Zod (every API route)
Error Track:    Sentry
```

---

## STEP 1 — Install Dependencies

```bash
npm install jose otpauth @upstash/redis @upstash/ratelimit zod @sentry/nextjs
```

---

## STEP 2 — Master Environment Variables

Create .env.local with ALL variables:

```env
# ── DATABASE ──────────────────────────────────
DATABASE_URL="postgresql://user:password@host/jivnicare?schema=public"

# ── JWT ───────────────────────────────────────
JWT_SECRET="minimum-32-character-random-secret-key"
JWT_EXPIRES_IN="7d"

# ── UPSTASH REDIS ─────────────────────────────
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# ── OTP ───────────────────────────────────────
OTP_EXPIRY_SECONDS=300
OTP_LENGTH=6

# ── ADMIN TOTP ────────────────────────────────
ADMIN_TOTP_SECRET="BASE32-ENCODED-SECRET"

# OTP SMS — 2Factor.in
TWOFACTOR_API_KEY="your-2factor-api-key"


# ── RESEND (Email) ────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxx"
RESEND_FROM_EMAIL="noreply@jivnicare.com"

# ── CLOUDINARY (File uploads) ─────────────────
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_UPLOAD_PRESET="jivnicare-docs"

# ── SENTRY (Error monitoring) ─────────────────
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"

# ── WHATSAPP (Meta Business API) ──────────────
WHATSAPP_TOKEN="your-meta-token"
WHATSAPP_PHONE_ID="your-phone-id"

# ── APP ───────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://jivnicare.com"
NODE_ENV="production"
```

---

## STEP 3 — Redis Client

Create src/lib/redis.ts:

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default redis
```

---

## STEP 4 — Prisma Client Singleton

Create src/lib/prisma.ts:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

---

## STEP 5 — Auth Utilities

Create src/lib/utils/auth.ts:

```typescript
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const SECRET  = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE  = 'jvc_session'

export async function createJWT(payload: {
  userId: string
  role: string
  sessionId: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { userId: string; role: string; sessionId: string }
  } catch {
    return null
  }
}

export async function getSession() {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  return verifyJWT(token)
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export function clearSessionCookie() {
  cookies().delete(COOKIE)
}
```

---

## STEP 6 — API Response Utilities

Create src/lib/utils/api-response.ts:

```typescript
import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// Safe messages — never expose internal errors to frontend
export const ERRORS = {
  UNAUTHORIZED:      'Authentication required.',
  FORBIDDEN:         'You do not have permission.',
  NOT_FOUND:         'Not found.',
  RATE_LIMITED:      'Too many requests. Please slow down.',
  SERVER_ERROR:      'Something went wrong. Please try again.',
  INVALID_OTP:       'Invalid OTP. Try again.',
  OTP_EXPIRED:       'OTP expired. Request a new one.',
  OTP_BLOCKED:       'Too many attempts. Try after 15 minutes.',
  BOOKING_LIMIT:     'You already have 3 active bookings today.',
  QUEUE_FULL:        'No slots available for today.',
  INVALID_STATE:     'This action is not allowed at current status.',
  INVALID_DISTRICT:  'Service available only in Jamui and Deoghar.',
}
```

---

## STEP 7 — Logical Date Utility

Create src/lib/utils/logical-date.ts:

```typescript
// See logical date timezone formula in docs/01-backend-schema.md (Canonical Source of Truth)

export function getLogicalDate(now = new Date()): Date {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + IST_OFFSET)
  const hours = istNow.getUTCHours()

  const logicalDate = new Date(istNow)
  if (hours < 4) {
    logicalDate.setUTCDate(logicalDate.getUTCDate() - 1)
  }

  logicalDate.setUTCHours(0, 0, 0, 0)
  return logicalDate
}
```

---

## STEP 8 — Rate Limiting

Create src/lib/utils/rate-limit.ts:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import redis from '@/lib/redis'
import { NextRequest, NextResponse } from 'next/server'

export const rateLimits = {
  otp:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   '15m'), prefix: 'rl:otp'    }),
  login:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10,  '1h'),  prefix: 'rl:login'  }),
  search: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1h'),  prefix: 'rl:search' }),
  admin:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, '1h'),  prefix: 'rl:admin'  }),
}

export async function applyRateLimit(
  request: NextRequest,
  limiter: Ratelimit
): Promise<NextResponse | null> {
  const ip = request.ip
    ?? request.headers.get('x-forwarded-for')
    ?? 'anonymous'

  const { success, limit, remaining, reset } = await limiter.limit(ip)

  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset':     reset.toString(),
        },
      }
    )
  }
  return null
}
```

### SMS Abuse Prevention
On the public OTP endpoint (`/api/v1/auth/send-otp`), a layered defense is required:
1. **Per-Phone-Number limit:** Max 5 OTP requests per phone number per 15-minute window.
2. **Per-IP limit:** Max 10 OTP requests per IP address per hour, backed by a `RateLimitLog` check.
3. **Bot Detection:** Integration of Cloudflare Turnstile token validation. The client must submit the Turnstile token, and the server verifies it against the Turnstile verify API before dispatching the OTP.
4. **Georestrictions & Format Checks:** Only `+91` Indian mobile numbers are accepted. Validate against a 10-digit format starting with 6–9. Manual onboarding is used for foreign doctor edge cases, bypassing the public OTP flow.

---

## STEP 9 — Rate Limit Reference Table

| Endpoint                    | Limit            | Window  | Action on exceed |
|-----------------------------|------------------|---------|-----------------|
| /api/auth/send-otp          | 5 requests       | 15 min  | 429 block       |
| /api/auth/verify-otp        | 10 attempts      | 1 hour  | 429 block       |
| /api/public/search          | 100 requests     | 1 hour  | 429 block       |
| /api/admin/*                | 200 requests     | 1 hour  | 429 block       |
| /api/patient/book           | 3 active/day     | per day | 400 error       |
| /api/doctor/queue/*         | No hard limit    | —       | Audit every     |

---

## STEP 10 — Auth Service

Create src/lib/services/auth.service.ts:

```typescript
import redis from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { createJWT, setSessionCookie } from '@/lib/utils/auth'
import crypto from 'crypto'

const OTP_KEY      = (p: string) => `otp:${p}`
const ATTEMPT_KEY  = (p: string) => `otp_att:${p}`

// ── GENERATE OTP ─────────────────────────────────────────────
export async function generateOTP(phone: string) {
  const attempts = await redis.get<number>(ATTEMPT_KEY(phone))
  if (attempts && attempts >= 5) {
    const ttl = await redis.ttl(ATTEMPT_KEY(phone))
    return { success: false, message: ERRORS.OTP_BLOCKED, retryAfter: ttl }
  }

  const otp  = crypto.randomInt(100000, 999999).toString()
  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  await redis.set(OTP_KEY(phone), hash, { ex: 300 })

  // Send via 2Factor.in — 2 attempts, silent fail on both
  await sendOTP(phone, otp)

  return { success: true, message: 'OTP sent' }
}

// ── VERIFY OTP ───────────────────────────────────────────────
export async function verifyOTP(phone: string, otp: string) {
  const stored = await redis.get<string>(OTP_KEY(phone))
  if (!stored) return { success: false, message: ERRORS.OTP_EXPIRED }

  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  if (hash !== stored) {
    await redis.incr(ATTEMPT_KEY(phone))
    await redis.expire(ATTEMPT_KEY(phone), 900)
    const att = await redis.get<number>(ATTEMPT_KEY(phone))
    if (att && att >= 5) return { success: false, message: ERRORS.OTP_BLOCKED }
    return { success: false, message: ERRORS.INVALID_OTP }
  }

  await redis.del(OTP_KEY(phone))
  await redis.del(ATTEMPT_KEY(phone))

  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({ data: { phone, role: 'PATIENT' } })
  }

  if (user.isBanned) return { success: false, message: 'Account suspended.' }

  await enforceSessionLimit(user.id, user.role)

  const session = await prisma.authSession.create({
    data: {
      userId:    user.id,
      token:     crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const jwt = await createJWT({ userId: user.id, role: user.role, sessionId: session.id })
  setSessionCookie(jwt)

  return { success: true, message: 'Login successful' }
}

// ── SESSION LIMIT ─────────────────────────────────────────────
async function enforceSessionLimit(userId: string, role: string) {
  const limits: Record<string, number> = { PATIENT: 2, DOCTOR: 3, ADMIN: 1 }
  const limit = limits[role] ?? 2

  const sessions = await prisma.authSession.findMany({
    where:   { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
  })

  if (sessions.length >= limit) {
    const toRevoke = sessions.slice(0, sessions.length - limit + 1)
    await prisma.authSession.deleteMany({
      where: { id: { in: toRevoke.map(s => s.id) } },
    })
  }
}

// ── 2FACTOR.IN OTP ────────────────────────────────────────────
async function sendOTP(phone: string, otp: string) {
  const apiKey = process.env.TWOFACTOR_API_KEY!

  const send = async () => {
    await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/OTP1`,
      {
        method:  'GET',
      }
    )
  }

  // 2 attempts with 2s delay
  try { await send() } catch {
    await new Promise(r => setTimeout(r, 2000))
    try { await send() } catch { /* silent fail — user will resend */ }
  }
}

// ── LOGOUT ────────────────────────────────────────────────────
export async function logout(sessionId: string) {
  await prisma.authSession.deleteMany({ where: { id: sessionId } })
}

import { ERRORS } from '@/lib/utils/api-response'
```

---

## STEP 11 — Admin TOTP

Create src/lib/utils/totp.ts:

```typescript
import * as OTPAuth from 'otpauth'

export function verifyAdminTOTP(token: string): boolean {
  const totp = new OTPAuth.TOTP({
    secret:    OTPAuth.Secret.fromBase32(process.env.ADMIN_TOTP_SECRET!),
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
  })
  return totp.validate({ token, window: 1 }) !== null
}

### Admin Authentication (V1 — Single Admin)
- The platform uses a single admin account in V1. There is no private/unguessable login URL; the Admin logs in at `/admin/login` using Google OAuth.
- **First-Time Login Setup:** Upon first successful Google OAuth login, the admin is presented with a TOTP setup page displaying a QR code (and manual secret key fallback). After the admin enters the 6-digit TOTP code to confirm, the setup generates 10 backup codes (shown exactly once, requiring explicit "I've saved these, continue" acknowledgment).
- **Subsequent Logins:** Requires either the Google OAuth login + a 6-digit TOTP code, or a single-use backup code.
- **Backup Code Recovery:** Admin can use one unused backup code to authenticate. Login via backup code marks that code as used (`used = true`). The admin can regenerate backup codes in settings, which requires re-entering the current active TOTP code.
```

---

## STEP 12 — Audit Service

Create src/lib/services/audit.service.ts:

```typescript
import { prisma } from '@/lib/prisma'
import { AuditAction, Role } from '@prisma/client'

export function createAuditLog(data: {
  userId?:    string
  role?:      Role
  action:     AuditAction
  entityType: string
  entityId?:  string
  oldValue?:  object
  newValue?:  object
  ipAddress?: string
}) {
  // Fire and forget — never blocks main operation
  prisma.auditLog.create({
    data: {
      ...data,
      oldValue: data.oldValue ? JSON.stringify(data.oldValue) : undefined,
      newValue: data.newValue ? JSON.stringify(data.newValue) : undefined,
    },
  }).catch(err => console.error('AuditLog failed:', err))
}
```

---

## STEP 13 — Middleware

Create src/middleware.ts (project root):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/utils/auth'

const PUBLIC = [
  '/',
  '/login',
  '/doctors',
  '/api/public',
  '/api/auth', // Allows all NextAuth callback/signin routes and OTP endpoints
  '/api/health',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next())
  }

  const token   = request.cookies.get('jvc_session')?.value
  const session = token ? await verifyJWT(token) : null

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role guards
  const isAdmin   = session.role === 'ADMIN'
  const isDoctor  = session.role === 'DOCTOR'

  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && !isAdmin) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  if ((pathname.startsWith('/doctor') || pathname.startsWith('/api/doctor'))
    && !isDoctor && !isAdmin) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  // Inject session into headers
  const headers = new Headers(request.headers)
  headers.set('x-user-id',    session.userId)
  headers.set('x-user-role',  session.role)
  headers.set('x-session-id', session.sessionId)

  return addSecurityHeaders(NextResponse.next({ request: { headers } }))
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options',        'SAMEORIGIN')
  response.headers.set('X-XSS-Protection',       '1; mode=block')
  response.headers.set('Referrer-Policy',        'origin-when-cross-origin')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

---

## STEP 14 — next.config.ts Security Headers + CORS

```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on'                    },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN'            },
  { key: 'X-Content-Type-Options',  value: 'nosniff'               },
  { key: 'X-XSS-Protection',        value: '1; mode=block'         },
  { key: 'Referrer-Policy',         value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=(self)' },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',      value: 'https://jivnicare.com' },
          { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },
}
export default nextConfig
```

---

## STEP 15 — Health Check Endpoint

Create src/app/api/health/route.ts:

```typescript
import { prisma }  from '@/lib/prisma'
import redis       from '@/lib/redis'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    await redis.ping()
    return apiSuccess({
      status:    'healthy',
      db:        'connected',
      redis:     'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return apiError('Service unhealthy', 503)
  }
}
```

---

## STEP 16 — Doctor Ban Workflow

Execute in this exact order when admin bans a doctor:

```
1. doctor.verificationStatus = SUSPENDED
2. doctor.canShowOnPublic    = false
3. doctor.isAcceptingBookings = false
4. doctor.availabilityStatus = OFFLINE
5. Delete all doctor auth_sessions
6. Keep active QueueTokens — admin decides cancel/transfer/close
7. Create AuditLog (action: BAN)
8. Create in-app Notification for affected patients
```

---

## ACCESS CONTROL MATRIX

| Route                | PATIENT | DOCTOR | ADMIN | PUBLIC |
|----------------------|---------|--------|-------|--------|
| /                    | ✅      | ✅     | ✅    | ✅     |
| /api/public/*        | ✅      | ✅     | ✅    | ✅     |
| /api/auth/*          | ✅      | ✅     | ✅    | ✅     |
| /api/health          | ✅      | ✅     | ✅    | ✅     |
| /api/patient/*       | ✅      | ❌     | ✅    | ❌     |
| /api/doctor/*        | ❌      | ✅     | ✅    | ❌     |
| /api/admin/*         | ❌      | ❌     | ✅    | ❌     |
| /patient/*           | ✅      | ❌     | ✅    | ❌     |
| /doctor/*            | ❌      | ✅     | ✅    | ❌     |
| /admin/*             | ❌      | ❌     | ✅    | ❌     |

---

## SESSION LIMITS

| Role    | Max Sessions | New login behavior              |
|---------|--------------|---------------------------------|
| PATIENT | 2            | Oldest session auto-revoked     |
| DOCTOR  | 3            | Oldest session auto-revoked     |
| ADMIN   | 1            | Previous session auto-revoked   |

---

## SECURITY HARDENING CHECKLIST

```
✅ JWT in httpOnly cookie only
✅ Input validation (Zod) on every API route
✅ Rate limiting on all sensitive endpoints
✅ SQL injection impossible (Prisma ORM)
✅ XSS prevention (CSP headers + httpOnly cookie)
✅ CSRF protection (sameSite=strict cookie)
✅ CORS restricted to jivnicare.com only
✅ No sensitive data in frontend bundle
✅ Environment variables server-side only
✅ Admin TOTP mandatory
✅ Audit logging all actions
✅ Sentry error monitoring
✅ Security headers on all routes
✅ npm audit in CI/CD pipeline
✅ No raw SQL (except JVC sequence)
✅ Soft delete only (deletedAt field)
✅ OTP hashed before Redis storage (SHA-256)
✅ Session invalidation on ban
✅ Doctor 48hr activation expiry
✅ No stack traces in production responses
```

---

## PII ENCRYPTION AT REST (V1)
- **Encryption Algorithm:** AES-256-GCM at the application layer.
- **Scope:** `User.phone` and `Admin.totpSecret` are encrypted before database insertion. The secret encryption key is stored in Vercel's encrypted environment variables.
- **Lookup Support:** A `phoneHash` field stores the deterministic HMAC of the phone number. All reads/writes route through a single encryption service helper.
- **Decryption Access Policy:** Decryption of the phone field is permitted for display in authorized Admin and Doctor panels, specifically for patient-contact and booking-verification purposes. This is a read-time decryption at the point of display, not a relaxation of the storage/lookup rules above.

## DATA DELETION PROCESS (V1 — MANUAL)
- **Flow:** Patient profile features a "Request Data Deletion" option. Selecting this creates a deletion request in the admin dashboard.
- **SLA:** Admin manually soft-deletes or anonymizes the user record within a committed 30-day window.

## DOCTOR NMC REGISTRATION VERIFICATION SOP
- **Onboarding:** Doctor submits NMC registration number + certificate photo/scan.
- **Approval:** Admin verification screen displays details side-by-side. The approval button is enabled ONLY after the admin types a manual verification confirmation note (`verificationNote`).
- **Enforcement:** The public doctor-search and profile API routes must filter `WHERE verificationStatus = 'APPROVED'` at the server route level. The database flag alone must never be trusted.

---

## WHAT NOT TO BUILD

```
❌ OAuth except Google OAuth for Doctors/Admin in V1
❌ Password-based authentication
❌ JWT in localStorage / sessionStorage / Zustand
❌ Admin TOTP bypass for any reason
❌ Raw error messages to frontend
❌ Console.log with sensitive data
❌ Patient ban (only doctor ban in V1)
❌ Self-signed certificates in production
```

---

## V2 DEFERRED DESIGN NOTES

### V2 Deferred — Full Multi-Admin RBAC
When more than one person operates the platform, replace the V1 single-Admin model with: SUPER_ADMIN (one, full access + admin management) and ADMIN (created only via Super Admin invite, no admin-management access). Adds AdminRole/AdminStatus enums, invite flow (48-hour expiring token, emailed link, invitee sets up their own TOTP — Super Admin never sees it), a 2-stage verification process (status is `PENDING_SETUP` until both Google-linking and TOTP setup are completed), a private/unguessable Super Admin login URL (env-var configured, excluded from sitemap/robots.txt), a Manage Admins dashboard (resend invite, suspend/reactivate, "Reset TOTP" with a required typed justification note for the lost-device-and-codes last resort), and a full AdminAuditLog recording every admin action with actor, target, metadata, IP, and timestamp.

### V2 Deferred — Automated DPDP Deletion
Replace the V1 manual 30-day deletion process with a DeletionRequest model + daily cron job: immediate deletedAt set on request (reusing the existing field), a configurable retention window during which an Admin can reverse the request, then automated overwrite of identifying PII fields (not deletion of the row itself, to preserve referential integrity with historical booking records) once the window passes.

---

## TOOL ASSIGNMENT

Cursor:     Execute steps 1-17 in sequence
Gemini CLI: After all steps done — run this prompt:
            "Read 02-security-access.md. Review all created files:
             middleware.ts, auth.service.ts, auth.ts, rate-limit.ts.
             Find any security gap, missing validation, or deviation
             from the spec. Report all issues."

---

Document complete. Execute steps 1-17 in sequence. Do not skip.
Last updated: June 2026 | JivniCare V1.0.0

