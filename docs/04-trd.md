# JivniCare V1.0.0 — Technical Requirements Document (TRD)
# Document: 04-trd.md
# Version: V1.0.0 FINAL

---

## ⚠ STRICT RULES — READ BEFORE EXECUTING

1. DO NOT implement anything not in this document or referenced docs
2. DO NOT add business logic in route files — services only
3. DO NOT import prisma in any UI component or page file
4. DO NOT store JWT in localStorage, sessionStorage, or Zustand
5. DO NOT use MongoDB in V1 — PostgreSQL only
6. DO NOT add WebSocket — 30s polling only
7. DO NOT add payment gateway — display-only system
8. DO NOT skip error handling — every service function has try/catch
9. ALL API responses use apiSuccess() / apiError() only
10. ASK NOTHING — execute exactly as written

---

## 1. SYSTEM OVERVIEW

```
Platform:     JivniCare — Queue-First Same-Day Doctor Booking
Market:       Jamui (Bihar) + Deoghar (Jharkhand) — V1 hard limit
Scale Target: 200 doctors · 20,000 patients (long term)
V1 Goal:      10 doctors + 500 patients in 3 months
Domain:       jivnicare.com
Admin:        jivnicare.com/admin
```

---

## 2. TARGET TECH STACK (Intended Design — Not Yet Fully Implemented)

```
Framework:     Next.js 14 (App Router) + TypeScript strict mode
Database:      PostgreSQL on Neon.tech
ORM:           Prisma 5.x
Cache:         Upstash Redis
Auth:          Patient: Phone OTP (2Factor.in) | Doctor/Admin: Google OAuth + NextAuth.js (Plus Admin TOTP 2FA)
Admin 2FA:     TOTP (otpauth)
File Upload:   Cloudinary (signed uploads)
OTP SMS:       2Factor.in (no DLT needed — OTP-specific India provider)
Email:         Resend.dev
WhatsApp:      Meta Business API (future V1 — not immediate)
Geocoding:     Nominatim/OpenStreetMap (FREE — address→lat/lng only)
Search:        PostgreSQL FTS + in-memory scoring
QR PDF:        @react-pdf/renderer
Error Track:   Sentry
Hosting:       Vercel (free tier → upgrade when needed)
CI/CD:         GitHub → main branch → Vercel auto deploy
PWA:           manifest.json + service worker (installable)
Styling:       Tailwind CSS + Shadcn/ui
State:         React Context (NO Zustand in V1)
Validation:    Zod (every API route — mandatory)
Rate Limit:    @upstash/ratelimit
```

---

## 3. FOLDER STRUCTURE — EXACT

Antigravity: Create this exact structure. No deviations.

```
jivnicare/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── logo.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← Root layout
│   │   ├── page.tsx                ← Homepage
│   │   ├── (patient)/
│   │   │   ├── login/page.tsx
│   │   │   ├── otp/page.tsx
│   │   │   ├── doctors/
│   │   │   │   └── [slug]/page.tsx ← Doctor profile
│   │   │   ├── search/page.tsx
│   │   │   ├── book/page.tsx
│   │   │   ├── bookings/page.tsx   ← My bookings
│   │   │   ├── token/
│   │   │   │   └── [id]/page.tsx   ← Token tracking
│   │   │   └── profile/page.tsx
│   │   ├── (doctor)/
│   │   │   ├── doctor/
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── queue/page.tsx
│   │   │   │   ├── patients/page.tsx
│   │   │   │   ├── profile/page.tsx
│   │   │   │   ├── schedule/page.tsx
│   │   │   │   ├── verification/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   ├── (admin)/
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx        ← Admin dashboard
│   │   │   │   ├── doctors/
│   │   │   │   │   ├── page.tsx    ← Doctor list
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── patients/page.tsx
│   │   │   │   ├── queue-monitor/page.tsx
│   │   │   │   ├── support/page.tsx
│   │   │   │   ├── metrics/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   ├── auth/
│   │   │   │   ├── send-otp/route.ts
│   │   │   │   ├── verify-otp/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   ├── public/
│   │   │   │   ├── home/route.ts
│   │   │   │   ├── search/route.ts
│   │   │   │   ├── doctors/[slug]/route.ts
│   │   │   │   ├── specialities/route.ts
│   │   │   │   └── districts/route.ts
│   │   │   ├── patient/
│   │   │   │   ├── book/route.ts
│   │   │   │   ├── bookings/route.ts
│   │   │   │   ├── tokens/[id]/route.ts
│   │   │   │   ├── profile/route.ts
│   │   │   │   └── waitlist/route.ts
│   │   │   ├── doctor/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── profile/route.ts
│   │   │   │   ├── status/route.ts
│   │   │   │   ├── schedule/route.ts
│   │   │   │   ├── queue/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   ├── advance/route.ts
│   │   │   │   │   └── walkin/route.ts
│   │   │   │   ├── tokens/[id]/route.ts
│   │   │   │   ├── patients/route.ts
│   │   │   │   ├── qr-sticker/route.ts
│   │   │   │   └── export/route.ts
│   │   │   └── admin/
│   │   │       ├── stats/route.ts
│   │   │       ├── queue-health/route.ts
│   │   │       ├── doctors/
│   │   │       │   ├── route.ts
│   │   │       │   ├── [id]/route.ts
│   │   │       │   ├── [id]/verify/route.ts
│   │   │       │   └── [id]/ban/route.ts
│   │   │       ├── patients/route.ts
│   │   │       ├── pricing/route.ts
│   │   │       └── search-insights/route.ts
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── maintenance/page.tsx
│   ├── components/
│   │   ├── ui/                     ← Shadcn components
│   │   ├── shared/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── SpecialitySelect.tsx ← Searchable dropdown
│   │   │   ├── QueueBadge.tsx
│   │   │   ├── DoctorCard.tsx
│   │   │   └── TokenStatusCard.tsx
│   │   ├── patient/
│   │   ├── doctor/
│   │   └── admin/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── booking.service.ts
│   │   │   ├── search.service.ts
│   │   │   ├── doctor.service.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── notification.service.ts
│   │   ├── utils/
│   │   │   ├── auth.ts
│   │   │   ├── api-response.ts
│   │   │   ├── logical-date.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── totp.ts
│   │   ├── data/
│   │   │   ├── symptom-map.ts      ← 200+ Hindi+English symptoms
│   │   │   └── specialities.ts     ← 20 specialities ordered
│   │   └── schemas/
│   │       ├── auth.schema.ts
│   │       ├── booking.schema.ts
│   │       ├── doctor.schema.ts
│   │       └── admin.schema.ts
│   ├── middleware.ts               ← Project root level
│   └── types/
│       ├── queue.types.ts
│       └── api.types.ts
├── GEMINI.md                       ← Gemini CLI context file
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. CLEAN ARCHITECTURE — 4 LAYERS

```
Layer 1 — UI (src/app/**/page.tsx)
  → Display only
  → NO business logic
  → NO prisma import
  → NO direct API calls to external services
  → Only calls internal API routes

Layer 2 — API Routes (src/app/api/**/route.ts)
  → Validate input (Zod) → Check auth (getSession) → Call service → Return JSON
  → NO business logic
  → NO direct prisma queries
  → ONLY: validate + auth + service call + return

Layer 3 — Services (src/lib/services/*.service.ts)
  → ALL business logic here ONLY
  → Direct prisma access allowed
  → Direct redis access allowed
  → Returns plain objects (not NextResponse)

Layer 4 — Data (src/lib/prisma.ts + redis.ts)
  → DB clients only
  → No logic
```

---

## 4.1 AUTHENTICATION MODEL

- **Patient:** Phone OTP only (via 2Factor.in) for signup and every login. No password.
- **Doctor & Admin — Two-Stage Model:**
  - **Registration (One-time):** Phone number verified via **2Factor.in OTP** (for identity verification and SMS reminders).
  - **Login (Every time after registration):** **Google OAuth ("Sign in with Google")** implemented via NextAuth.js / Auth.js. No passwords or forgot-password flows.
  - **Account Linking:** Google account is linked in Step 2 of registration to capture the email and Google ID.
- **Admin Access Model (V1):** V1 uses a single Admin account authenticated via Google OAuth + TOTP. No invite flow exists in V1 — see 02-security-access.md for the full authentication specification. A multi-admin invite flow is deferred to V2 — see the V2 note in 02-security-access.md.

---

## 5. COMPLETE API ROUTES

### Public Routes (no auth required)
```
GET  /api/health                    → DB + Redis health check
GET  /api/public/home               → Featured doctors + specialities + districts
GET  /api/public/search             → Search doctors (rate limited: 100/hr)
GET  /api/public/doctors/[slug]     → Doctor public profile
GET  /api/public/specialities       → All active specialities
GET  /api/public/districts          → Jamui + Deoghar
```

### Auth Routes
```
POST /api/auth/send-otp             → Send OTP via 2Factor.in (rate limited: 5/15min)
POST /api/auth/verify-otp           → Verify OTP + create session
POST /api/auth/logout               → Delete session + clear cookie
GET  /api/auth/me                   → Current user info
```

### Patient Routes (auth required — PATIENT role)
```
POST   /api/patient/book            → Book appointment (max 3/day)
GET    /api/patient/bookings        → My active bookings
GET    /api/patient/tokens/[id]     → Token status (30s polling)
DELETE /api/patient/tokens/[id]     → Cancel token (allowed states only)
GET    /api/patient/profile         → Get profile
PUT    /api/patient/profile         → Update profile
POST   /api/patient/waitlist        → Join waitlist when queue full
```

### Doctor Routes (auth required — DOCTOR role)
```
POST /api/doctor/register           → Multi-step registration
GET  /api/doctor/profile            → Get own profile
PUT  /api/doctor/profile            → Update profile, fee, schedule
PUT  /api/doctor/status             → Change status (AVAILABLE/BREAK/BUSY/OFFLINE)
GET  /api/doctor/schedule           → Get schedule
PUT  /api/doctor/schedule           → Update schedule + daily limit
GET  /api/doctor/queue              → Today's queue (regular + emergency)
PUT  /api/doctor/queue/advance      → Call next / mark complete
POST /api/doctor/queue/walkin       → Add walk-in patient
PUT  /api/doctor/tokens/[id]        → Update token status
GET  /api/doctor/patients           → Patient history (with PDF export)
GET  /api/doctor/qr-sticker         → Download branded QR PDF
GET  /api/doctor/export             → Export patient data PDF (max 31 days)
```

### Admin Routes (auth required — ADMIN role — rate limited: 200/hr)
```
GET  /api/admin/stats               → Platform stats (30s refresh)
GET  /api/admin/queue-health        → All active queues monitor
GET  /api/admin/doctors             → Doctor list with filters
GET  /api/admin/doctors/[id]        → Doctor detail
PUT  /api/admin/doctors/[id]        → Update doctor
POST /api/admin/doctors/[id]/verify → Approve doctor
POST /api/admin/doctors/[id]/reject → Reject doctor with reason
POST /api/admin/doctors/[id]/ban    → Ban doctor
POST /api/admin/doctors/onboard     → Admin onboard new doctor
GET  /api/admin/patients            → Patient list
PUT  /api/admin/pricing             → Update platform pricing
GET  /api/admin/search-insights     → Top searches + zero result queries
```

---

## 6. QUEUE ENGINE — COMPLETE SPEC

```
Regular Queue:   tokenNumber = 1, 2, 3...
Emergency Queue: tokenNumber = E1, E2, E3... (separate DailyQueue)
Walk-in tokens:  Same regular sequence, type=WALKIN badge on dashboard

WALK-IN AUTO-LINKING:
  When a walk-in patient is created, the system performs a silent server-side lookup:
  `SELECT id FROM users WHERE phone = ? AND role = 'PATIENT'`
  - If a registered patient matches the phone number, QueueToken.patientId is automatically linked to that user.
  - If not matched, patientId remains null (anonymous walk-in).
  - Note: There is zero UI or workflow change for the doctor or receptionist. The walk-in form remains a simple name, phone number, and address field. The auto-linking occurs silently in the service layer.

ATOMIC BOOKING (race condition prevention):
  Use Prisma $transaction with:
  1. SELECT daily_queues WHERE doctorId + date + type FOR UPDATE
  2. Check totalTokens < dailyLimit
  3. Increment totalTokens
  4. Create QueueToken with tokenNumber = totalTokens
  All in one transaction — concurrent requests safe

BOOKING IDEMPOTENCY (duplicate prevention):
  To prevent duplicate bookings from network failures:
  1. The client generates a unique UUID `idempotencyKey` when the booking page first renders (not on submission).
  2. The `idempotencyKey` is sent in the body of the `POST /api/patient/book` request.
  3. The server checks the `QueueToken` table. If a token with the same `idempotencyKey` already exists, the server returns the existing token details (status 200) immediately.
  4. SMS notification dispatch, in-app notification creation, and audit log writes must all be skipped on this path — they already occurred on the original successful request. Only a genuinely new booking triggers these side effects.
  5. Retries from the client after a connection drop are resolved safely without double-booking or hitting cap limits.

BIDIRECTIONAL ADVANCE:
  Doctor clicks "Call Next":
    → Current token = CALLED
    → Previous IN_CONSULTATION token = auto COMPLETED
  Doctor clicks "Complete":
    → Current token = COMPLETED
    → Next READY token = auto CALLED

DOCTOR AVAILABILITY — 4-STATE GRANULAR MODEL:
  - AVAILABLE: Automatic trigger when current time crosses clinicStartTime. Normal booking and queue flow.
  - ON_BREAK / BUSY: Manual toggle by doctor/receptionist (temporary/same-day). Shows a calm inline breakMessage (e.g. "Doctor is on a short break — queue resumes shortly"). No active push notifications, no auto-cancellation, queue order is fully preserved.
  - OFFLINE: Manual override by doctor/receptionist ("not coming in today"). Shows a clear offline banner on the tracking page, and sends a proactive push/in-app notification to all booked patients for today. No auto-cancellation—patients decide if they want to cancel.
  - End-of-day Reset: Automatic, resets status to OFFLINE at 04:00 AM IST cron to allow the next day's schedule-based AVAILABLE trigger to fire.
  - Daily Limit: When totalTokens >= dailyTokenLimit, the profile displays "Fully Booked for Today". The online booking button is disabled. This is independent of AVAILABLE/ON_BREAK/OFFLINE. If dailyLimit is reduced mid-day, existing booked tokens are never cancelled; walk-ins bypass the daily limit entirely.

QUEUE CACHE:
  Redis key: queue:{queueId}
  TTL: 30 seconds
  Invalidate: immediately on every state change
  Miss: fresh DB fetch

WAITLIST DISPATCH — FIFO AUTO-BOOK:
  When a queue slot opens (doctor changes status to AVAILABLE, a patient cancels, or the daily limit is increased), the system auto-dispatches the oldest waitlist entry:
  1. Pull the oldest waitlist record (`createdAt` ascending) for the doctor.
  2. Create a new `QueueToken` with status `BOOKED` directly for that patient (no verification timer, no competition, no action needed from the patient).
  3. Send an informational, non-urgent notification: "Good news — your slot with Dr. [Name] is confirmed today, Token #[X]. Cancel from the app if you can't make it."
  4. If the patient cannot attend, they use the existing "Cancel Booking" flow to free the slot. If they do not show up, it is marked as `NO_SHOW` at the clinic. No background expiry or polling timers exist for waitlist claims. `NO_SHOW` remains strictly terminal — no reactivation transition exists. A late-arriving patient is registered as a new walk-in token by clinic staff (which will auto-link via walk-in lookup if they are a registered patient).

04:00 AM IST CRON (Vercel Cron):
  1. BOOKED/AWAITING_ARRIVAL tokens → EXPIRED
  2. Daily queues → CLOSED
  3. Doctor status → OFFLINE reset
  4. lifetimePatientsServed + jivnicarePatientsServed stats update
  5. search_logs older than 90 days → DELETE
  6. AuditLog entry created
```

---

## 7. VERCEL CRON — Implementation

Add to vercel.json:
```json
{
  "crons": [
    {
      "path": "/api/cron/midnight-cleanup",
      "schedule": "30 22 * * *"
    }
  ]
}
```
Note: 22:30 UTC = 04:00 AM IST

Create src/app/api/cron/midnight-cleanup/route.ts:
```typescript
// Secured with CRON_SECRET header
// Vercel automatically sends Authorization header
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // Execute all cleanup tasks
  // 1. Expire stale tokens
  // 2. Close queues
  // 3. Reset doctor status
  // 4. Update stats
  // 5. Delete old search_logs
}
```

Add to .env.local:
```
CRON_SECRET="random-secure-string-here"
```

---

## 8. NOTIFICATION SYSTEM

```
Channel 1 — In-app (DB):
  → All events stored in notifications table
  → Patient sees in My Bookings + notification bell
  → Doctor sees in dashboard

Channel 2 — Browser Push (PWA):
  → Service worker registers push subscription
  → Used for: doctor status change, token called
  → Free, works on mobile PWA install

Channel 3 — OTP SMS (2Factor.in):
  → Only for auth OTP
  → 2 attempts, silent fail
  → No DLT needed (India-optimized OTP provider)
  → UI shows a Resend OTP button with 30-second cooldown after silent fail — no email fallback in V1.

Channel 4 — Email (Resend.dev):
  → Doctor: verification approved/rejected
  → Doctor: account activation link
  → Free 3000 emails/month

WhatsApp (Meta Business API):
  → V1 future — infrastructure ready, not immediate
  → Free 1000 conversations/month

NOTIFICATION TEMPLATES:

Booking confirmed (in-app):
  Title: "Booking Confirmed!"
  Body:  "Token #[X] with Dr. [Name]. Visit [Clinic] today."

Doctor offline (in-app + push):
  Title: "Dr. [Name] is on a break"
  Body:  "Your token #[X] is still valid. Queue will resume soon."

Token called (push):
  Title: "Your turn is coming!"
  Body:  "Token #[X] — 2 patients ahead. Please be ready."

Verification approved (email):
  Subject: "Welcome to JivniCare! Your profile is live."
  Body: Professional HTML email with dashboard link

Verification rejected (email):
  Subject: "Action Required — JivniCare Verification"
  Body: Rejection reason + resubmission instructions
```

---

## 9. PWA CONFIGURATION

Create public/manifest.json:
```json
{
  "name": "JivniCare",
  "short_name": "JivniCare",
  "description": "Book Doctor Appointments",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8F9FA",
  "theme_color": "#2563EB",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to src/app/layout.tsx:
```typescript
export const metadata = {
  manifest: '/manifest.json',
  themeColor: '#2563EB',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'JivniCare' },
}
```

---

## 10. CI/CD PIPELINE

```
Developer writes code
      ↓
git commit + git push (to feature branch)
      ↓
GitHub Pull Request
      ↓
GitLab Duo reviews code (MR suggestions)
      ↓
TypeScript type check (tsc --noEmit)
      ↓
Build check (next build)
      ↓
Merge to main branch
      ↓
Vercel auto-deploy to production
      ↓
/api/health check passes
      ↓
Live ✅

RULES:
- No direct commits to main branch
- No production code edits without Git
- Every PR reviewed before merge
- npm audit run in CI
- TypeScript errors = build fails
```

---

## 11. DOCTOR REGISTRATION — EXACT 4 STEPS

```
STEP 1 — Basic Info (Lead captured here)
  Fields: naam, phone, speciality
  Action: OTP verify → user created → PENDING_ACTIVATION
  Purpose: Even if doctor stops here, lead is captured

STEP 2 — Clinic & Owner Info
  Fields: clinicName, clinicAddress, clinicCity, clinicDistrict,
          clinicPincode, operatorName, operatorMobile,
          receptionist1-3 (naam + phone)
  Action: Save → registrationStep = 2

STEP 3 — Professional + Documents
  Fields: qualifications[], registrationNumber, experienceYears,
          gender, bio, languages[], expertiseTags[],
          diseases[], procedures[], profilePhoto,
          documents[] (max 10 via Cloudinary),
          isEmergencyEnabled, emergencyCapacity,
          clinicPhotos[] (max 3 via Cloudinary)
  Action: Save → registrationStep = 3 → verificationStatus = PENDING_REVIEW
          → Admin notified for review

STEP 4 — Schedule Setup (can be done from dashboard later)
  Fields: weeklySchedule JSON, bookingWindowStart,
          bookingWindowEnd, dailyTokenLimit, consultationFee
  Action: Save → registrationStep = 4 → registrationComplete = true

ADMIN ONBOARD FLOW:
  Admin fills Steps 1-3 on behalf of doctor
  → System sends OTP SMS to doctor phone
  → Doctor verifies OTP within 48 hours
  → Auto-verified → canShowOnPublic = true
  → If 48hr expire → PENDING_ACTIVATION again
```

---

## 12. DOCTOR QR STICKER — SPEC

```
Library: @react-pdf/renderer

Sticker Contents:
  - JivniCare logo (top, branded)
  - Doctor name (bold, large)
  - Speciality
  - JVC001 ID
  - Clinic name + area
  - QR code (links to: jivnicare.com/doctors/[slug])
  - "Scan to Book Appointment" text
  - jivnicare.com (footer)

Design:
  Background: #1B3F6B (brand navy)
  QR code:    White on navy
  Text:       White
  Size:       A4 (for printing) + 10x10cm sticker size (both in PDF)

API: GET /api/doctor/qr-sticker
     → Returns PDF blob
     → Doctor downloads from dashboard
```

---

## 13. SAAS ARCHITECTURE — 23-LAYER AUDIT

| Layer                    | Status      | Risk   | Notes                              |
|--------------------------|-------------|--------|------------------------------------|
| System Design            | Present     | Low    | Queue-first, clean arch            |
| System Architecture      | Present     | Low    | 4-layer clean architecture         |
| Frontend                 | Present     | Low    | Next.js 14, mobile-first, PWA      |
| APIs & Backend Logic     | Present     | Low    | REST, Zod validation, services     |
| Database & Storage       | Present     | Low    | PostgreSQL, Prisma, Neon           |
| Auth & Permissions       | Present     | Low    | OTP, JWT, TOTP, role-based         |
| Hosting & Cloud          | Present     | Low    | Vercel, auto-scaling               |
| CI/CD & Version Control  | Present     | Low    | GitHub → Vercel auto deploy        |
| Security                 | Present     | Low    | Headers, CORS, rate limit, Sentry  |
| Rate Limiting            | Present     | Low    | Upstash, per-endpoint limits       |
| Caching & CDN            | Present     | Low    | Redis + Vercel Edge CDN            |
| Error Tracking           | Present     | Low    | Sentry (free tier)                 |
| Monitoring & Alerts      | Partial     | Medium | /api/health — full APM V2          |
| Testing                  | Missing     | Medium | Manual testing V1 — Jest V2        |
| Scalability              | Present     | Low    | Vercel serverless, Neon scale      |
| Legal & Compliance       | Present     | Low    | DPDP 2023, IT Act, terms pages     |
| Privacy & Data           | Present     | Low    | Soft delete, data deletion option  |
| Audit Logging            | Present     | Low    | All actions, all roles             |
| Doctor Verification      | Present     | Low    | Manual admin review                |
| Appointment Management   | Present     | Low    | Queue engine, state machine        |
| Payment Architecture     | Present     | Low    | Display-only, pay at clinic        |
| Notification Architecture| Partial     | Medium | In-app + push + SMS — WhatsApp V1+ |
| Search                   | Present     | Low    | PostgreSQL FTS + symptom map       |

---

## 14. DEFERRED TO V2 — DO NOT BUILD

```
❌ MongoDB Atlas
❌ WebSocket / real-time
❌ Telemedicine / video
❌ EMR / prescriptions
❌ Ratings & reviews
❌ Payment gateway (Razorpay/Stripe)
❌ Android / iOS native app
❌ Booking widget embed
❌ Agent separate role
❌ Multi-clinic table
❌ WhatsApp immediate (infrastructure ready)
❌ Jest automated tests
❌ Full APM monitoring
❌ Maps widget (geocoding only in V1)
❌ Push notification full system (basic only)
```

---

## 15. TOOL ASSIGNMENT — PER PHASE

```
PHASE 0 — Foundation:
  Antigravity → Create entire folder structure + empty service stubs
  Antigravity    → prisma/schema.prisma + migrations + seed.ts + env setup
  Antigravity  → "Read GEMINI.md + 04-trd.md. Verify folder structure
                 matches Section 3. Report any deviation."

PHASE 1 — Data Layer:
 Antigravity       → All lib/ files: prisma.ts, redis.ts, all utils/
  Antigravity → All Zod schema files from lib/schemas/
  Antigravity  → "Do all utility functions match 02-security-access.md?"

PHASE 2 — Authentication:
 Antigravity      → auth.service.ts complete + all auth API routes
  Antigravity  → "Review auth.service.ts + middleware.ts.
                 Find any security gap vs 02-security-access.md"

PHASE 3 — Queue Engine (MOST CRITICAL):
 Antigravity      → queue.service.ts + booking.service.ts + all queue routes
  Antigravity   → "Verify queue state machine matches 04-trd.md Section 6.
                 Is booking atomic? Can race condition occur?"
 Antigravity  → Review every queue-related PR carefully

PHASE 4 — Search:
Antigravity   → search.service.ts + symptom-map.ts + search routes
 Antigravity   → "Does search.service.ts implement all 5 layers
                 from 03-search-engine.md?"

PHASE 5 — Dashboards:
 Antigravity     → All UI pages + doctor.service.ts + admin.service.ts
  Antigravity  → Admin page layouts scaffolding
Antigravity   → "Scan all app/(patient|doctor|admin)/ files.
                 Any prisma import? Any business logic? Report."

PHASE 6 — Polish:
   Antigravity    → Error states, Sentry setup, mobile responsive
  Antigravity → Seed script with realistic test data
    Antigravity → FINAL: "Full compliance review vs all .md docs.
                 Any deviation? Any V2 feature accidentally built?"

PHASE 7 — Launch:
  Antigravity    → Production env vars, Vercel deploy
  Antigravity  → "Pre-launch audit. Read all docs. Ready to launch?"
    Antigravity  → Final code review before production merge
```


---

## V2 DEFERRED DESIGN NOTES

### V2 Deferred — API Versioning
API routes remain unversioned (`/api/patient/*`, `/api/doctor/*`, `/api/admin/*`) for V1, since no external client exists yet that could be broken by a change. Add `/api/v1/` namespacing BEFORE any native mobile app or other non-web client begins development — retrofitting versioning after such a client ships is far more disruptive than adding it before.

---

Document complete. Execute phases in sequence. Do not skip.
Last updated: June 2026 | JivniCare V1.0.0

