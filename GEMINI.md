# JivniCare — GEMINI.md
# Version: V1.0.0 FINAL
# Location: Project root (/)

---

## WHAT IS JIVNICARE

Queue-first same-day doctor booking platform.
Market: Jamui (Bihar) + Deoghar (Jharkhand) only — V1 hard limit.
Goal: 10 doctors + 500 patients in 3 months.
Domain: jivnicare.com | Admin: jivnicare.com/admin

---

## COMPLETE TECH STACK

```
Framework:    Next.js 14 App Router + TypeScript strict
Database:     PostgreSQL on Neon.tech
ORM:          Prisma 5.x
Cache:        Upstash Redis
Auth:         OTP + JWT (jose) + httpOnly cookie + Admin TOTP
SMS:          Twilio (no DLT — transactional OTP exempt)
Email:        Resend.dev
Files:        Cloudinary (signed uploads)
Search:       PostgreSQL FTS + in-memory scoring (NO Elasticsearch)
QR/PDF:       @react-pdf/renderer + qrcode.react
Errors:       Sentry
Hosting:      Vercel (free tier)
CI/CD:        GitHub → main → Vercel auto deploy
PWA:          manifest.json + service worker
UI:           Tailwind CSS + Shadcn/ui + Lucide React
Fonts:        Poppins (display) + Inter (body) + Noto Sans Devanagari (Hindi)
State:        React Context only (NO Zustand in V1)
Validation:   Zod (every API route — mandatory)
Rate Limit:   @upstash/ratelimit
```

---

## 4-LAYER ARCHITECTURE — ENFORCE STRICTLY

```
Layer 1 — UI (src/app/**/page.tsx + src/components/)
  ✅ Display only
  ❌ NO business logic
  ❌ NO prisma import
  ❌ NO direct external API calls
  ❌ NO JWT handling

Layer 2 — API Routes (src/app/api/**/route.ts)
  ✅ Validate input (Zod)
  ✅ Check auth (getSession)
  ✅ Call service function
  ✅ Return apiSuccess() or apiError()
  ❌ NO business logic
  ❌ NO direct prisma queries
  ❌ NO complex calculations

Layer 3 — Services (src/lib/services/*.service.ts)
  ✅ ALL business logic HERE ONLY
  ✅ Direct prisma access allowed
  ✅ Direct redis access allowed
  ✅ Returns plain objects (NOT NextResponse)
  ❌ NO HTTP response objects

Layer 4 — Data (src/lib/prisma.ts + redis.ts)
  ✅ DB client singletons only
  ❌ NO logic of any kind
```

---

## ARCHITECTURE RULES — NEVER VIOLATE

```
AR-01: No business logic in any route.ts file
AR-02: No prisma import outside src/lib/ folder
AR-03: No prisma import in any UI component or page
AR-04: All API calls from UI use typed fetch wrapper
AR-05: All forms use react-hook-form + zodResolver
AR-06: JWT never stored client-side (httpOnly cookie only)
AR-07: All sensitive data from server components only
AR-08: Use apiSuccess()/apiError() in ALL route handlers
AR-09: Never show raw error messages to frontend
AR-10: All queue state transitions via queueService.transition() only
AR-11: All token ops use Prisma $transaction (atomic)
AR-12: Booking atomic: SELECT FOR UPDATE + increment in same transaction
```

---

## QUEUE ENGINE RULES — NON-NEGOTIABLE

```
Token States (ONE-WAY ONLY — no reverse):
  BOOKED → AWAITING_ARRIVAL → PAYMENT_PENDING → READY → CALLED → IN_CONSULTATION → COMPLETED
  READY/CALLED → NO_SHOW (alternative)
  BOOKED/AWAITING/PAYMENT_PENDING/READY → CANCELLED (patient cancel)
  BOOKED/AWAITING → EXPIRED (04:00 AM cron)

Token Number:
  Regular queue: 1, 2, 3...   (NEVER changes after creation)
  Emergency:     E1, E2, E3... (separate DailyQueue, type=EMERGENCY)
  Walk-in:       Same regular sequence, type=WALKIN (badge only)

Queue Isolation:
  Each queue: unique(doctorId + date + type)
  Dr. Sharma's patients NEVER appear in Dr. Verma's queue

Atomic Booking:
  Prisma $transaction with row lock
  SELECT dailyQueue FOR UPDATE → check limit → increment → create token
  Concurrent bookings: IMPOSSIBLE to get same token number

Bidirectional Advance:
  "Call Next"   → prev IN_CONSULTATION = auto COMPLETED, next READY = CALLED
  "Complete"    → current = COMPLETED, next READY = auto CALLED

Queue Cache:
  Redis key: queue:{queueId}  TTL: 30s
  Invalidate: IMMEDIATELY on every state change
  Miss: fresh DB fetch

Cron (04:00 AM IST = 22:30 UTC):
  BOOKED/AWAITING tokens → EXPIRED
  Daily queues → CLOSED
  Doctor status → OFFLINE
  Stats update + search_logs cleanup (90 days)
```

---

## DOCTOR STATUS RULES

```
4 States:
  AVAILABLE: isOnline=true,  isAcceptingBookings=true
  BREAK:     isOnline=false, isAcceptingBookings=false, breakMessage set
  BUSY:      isOnline=true,  isAcceptingBookings=false  (queue full)
  OFFLINE:   isOnline=false, isAcceptingBookings=false

Profile always visible to patients — even OFFLINE
Bookings blocked: BREAK + BUSY + OFFLINE
New bookings only: AVAILABLE
```

---

## AUTH RULES

```
Patient:  Max 2 concurrent sessions → oldest auto-revoked
Doctor:   Max 3 concurrent sessions → oldest auto-revoked (3 devices)
Admin:    Max 1 session → new login revokes previous

OTP:      5 wrong attempts → 15 min block
          Resend: 25 second cooldown
          Expiry: 5 minutes
          Storage: Redis (hashed SHA-256)

JWT:      httpOnly cookie ONLY
          NEVER: localStorage, sessionStorage, Zustand
          Expiry: 7 days

Admin:    OTP login + TOTP (Google Authenticator) mandatory
          NO TOTP bypass — ever
```

---

## SECURITY RULES

```
Input validation: Zod on EVERY API route — no exceptions
SQL injection:    Prisma ORM prevents — no raw SQL (except JVC sequence)
XSS:             CSP headers + httpOnly cookie
CSRF:            sameSite=strict cookie
CORS:            jivnicare.com only
Rate limits:
  OTP:    5 / 15 min
  Login:  10 / hour
  Search: 100 / hour
  Admin:  200 / hour
  Booking: max 3 active / patient / day

Audit logging: ALL roles, ALL actions — fire and forget
Errors: NEVER expose stack traces or internal errors to frontend
Delete: SOFT ONLY → archive → deletedAt field
```

---

## DATABASE — 14 TABLES

```
users              → All user accounts (patient + doctor + admin)
auth_sessions      → JWT sessions (max per role enforced)
doctors            → Doctor profiles + clinic info + schedule
daily_queues       → One per doctor per day per type (REGULAR/EMERGENCY)
queue_tokens       → Individual patient tokens
platform_pricing   → Display-only fee structure per doctor
notifications      → In-app notifications
audit_logs         → Complete action history
archived_records   → Soft-deleted records
waitlists          → Queue-full waitlist
doctor_requests    → Lead capture (no doctor found)
search_logs        → Anonymous search analytics (90-day TTL)
districts          → Jamui + Deoghar only
specialities       → 20 specialities (tier-ordered)

Doctor ID: JVC001 format — PostgreSQL SEQUENCE
Slug:      dr-{name}-{speciality}-{city} UNIQUE
Clinic:    In doctors table (no separate table V1)
```

---

## SEARCH ENGINE — 5 LAYERS

```
Layer 1: Symptom → Speciality mapping (200+ terms, Hindi+English)
Layer 2: PostgreSQL FTS — 8 fields (name, clinic, bio, speciality,
         diseases, procedures, city, internalDoctorId)
Layer 3: Scoring (100 pts):
         Keyword 40 + Availability 25 + Distance 20 +
         Profile Complete 10 + Early Partner 5
Layer 4: Hard filters (district, gender, language, fee, emergency)
Layer 5: Ranked results (online first)

Minimum query: 2 characters
Empty result:  "Request a Doctor" form → lead capture
Search logged: anonymously in search_logs table
Rate limited:  100 requests/hour
```

---

## PAYMENT SYSTEM — DISPLAY ONLY

```
ZERO actual payment processing in V1.
Patient pays doctor directly at clinic (cash).
JivniCare collects NO money.

Patient sees:
  Consultation Fee:    ₹[doctor fee]
  Convenience Fee:     ~~₹29~~ FREE 🎉
  Total Payable:       ₹[doctor fee]
  Method:              "Pay at Clinic"

Doctor sees:
  Platform Fee Waived: ₹2,999
  Total Value:         ₹X,XXX saved
  These are display values only — no actual billing

Formula: actualCharge = perBookingFee × (1 - discountPercent/100)
         V1 discountPercent = 100 → actualCharge = ₹0

Early Partner: First 20 doctors — EARLY_PARTNER tier — Gold badge
```

---

## NOTIFICATION CHANNELS

```
In-app:         notifications table → UI bell icon
Browser Push:   Service worker (PWA) → doctor status + token called
OTP SMS:        Twilio → auth only (2 attempts, silent fail)
Email:          Resend.dev → doctor verification/approval/rejection
WhatsApp:       Infrastructure ready, NOT launched in V1
```

---

## COMPLETE FOLDER STRUCTURE

```
src/
├── app/
│   ├── (patient)/login, otp, doctors/[slug], search,
│   │              book, bookings, token/[id], profile
│   ├── (doctor)/doctor/dashboard, queue, patients,
│   │            profile, schedule, verification, settings
│   ├── (admin)/admin/page, doctors/[id],
│   │           patients, queue-monitor, metrics, settings
│   ├── api/
│   │   ├── health/
│   │   ├── auth/send-otp, verify-otp, logout, me
│   │   ├── public/home, search, doctors/[slug],
│   │   │          specialities, districts
│   │   ├── patient/book, bookings, tokens/[id],
│   │   │          profile, waitlist
│   │   ├── doctor/register, profile, status, schedule,
│   │   │         queue/*, tokens/[id], patients,
│   │   │         qr-sticker, export
│   │   └── admin/setup, stats, queue-health,
│   │              doctors/*, patients, pricing,
│   │              search-insights
│   ├── not-found.tsx, error.tsx, maintenance/
├── components/ui/, shared/, patient/, doctor/, admin/
├── lib/
│   ├── prisma.ts, redis.ts
│   ├── services/ auth, queue, booking, search,
│   │            doctor, admin, audit, notification
│   ├── utils/ auth, api-response, logical-date,
│   │         rate-limit, totp
│   ├── data/  symptom-map.ts, specialities.ts
│   └── schemas/ auth, booking, doctor, admin
├── middleware.ts
└── types/ queue.types.ts, api.types.ts
```

---

## ALL DOCUMENTS — REFERENCE GUIDE

```
01-backend-schema.md   → Prisma schema, 14 tables, seed data
02-security-access.md  → Auth, JWT, OTP, rate limiting, middleware
03-search-engine.md    → 5-layer search, symptom map, scoring
04-trd.md              → Tech stack, folder structure, CI/CD
05-prd.md              → Product features, user roles, scope
06-web-flow.md         → All user journeys, page flows, error states
07-frontend-spec.md    → Components, pages, API mapping
08-design-ui-ux.md     → Colors, fonts, components, animations
09-payment-system.md   → Display-only payment, early partner
00-GEMINI.md           → This file (read first always)
```

---

## TOOL ASSIGNMENT — WHEN TO USE WHAT

```
CURSOR (active development):
  → Writing service files, API routes, UI components
  → Bug fixing, refactoring, debugging
  → All code that needs careful implementation

ANTIGRAVITY (bulk/agent tasks):
  → Creating entire folder structure at once
  → Generating all Zod schema files from spec
  → Creating all empty service stubs simultaneously
  → Generating seed scripts with test data
  → Batch file operations

GEMINI CLI (review + compliance):
  → After each phase: compliance check vs docs
  → "Read GEMINI.md. Does [file] match the spec?"
  → Cross-file analysis (eg: "Any prisma in UI components?")
  → Architecture violation detection
  → Pre-launch full audit

GITLAB DUO (code review):
  → Every pull request / merge request
  → Suggests improvements on changed files
  → Catches security issues in diffs

GOOGLE AI STUDIO (analysis):
  → Large document analysis
  → API testing and validation
  → Prompt engineering for complex tasks
  → Understanding codebase patterns
```

---

## PHASE-BY-PHASE GEMINI CLI PROMPTS

```
Phase 0 (Foundation):
  "Read GEMINI.md and 04-trd.md Section 3.
   Does the folder structure match exactly?
   List any missing files or wrong paths."

Phase 1 (Data Layer):
  "Read 02-security-access.md.
   Review: lib/prisma.ts, lib/redis.ts, lib/utils/auth.ts,
   lib/utils/api-response.ts, lib/utils/logical-date.ts.
   Any deviation from spec? Report all issues."

Phase 2 (Auth):
  "Read 02-security-access.md.
   Review: auth.service.ts + all api/auth/* routes + middleware.ts.
   Find any security vulnerability or spec deviation."

Phase 3 (Queue Engine — MOST CRITICAL):
  "Read GEMINI.md queue rules + 06-web-flow.md Section 2 (Doctor Flows).
   Review: queue.service.ts + booking.service.ts.
   Is booking truly atomic? Can two patients get same token?
   Does state machine allow any illegal transition?
   Is bidirectional advance implemented correctly?"

Phase 4 (Search):
  "Read 03-search-engine.md.
   Review: search.service.ts + symptom-map.ts + api/public/search/route.ts.
   Are all 5 layers implemented?
   Does Hindi symptom mapping work?
   Is search logging anonymous?"

Phase 5 (Dashboards):
  "Read AR-02 and AR-03 from GEMINI.md.
   Scan ALL files in:
   src/app/(patient)/, src/app/(doctor)/, src/app/(admin)/.
   Find any prisma import. Find any business logic.
   Report every violation with file path."

Phase 6 (Pre-Launch Final Audit):
  "Full compliance review. Read all 10 documents.
   Check entire codebase against every rule.
   Find: V2 features accidentally built,
         security gaps,
         architecture violations,
         missing error states,
         payment gateway code (must not exist).
   Give me a production readiness report."
```

---

## NOT IN V1 — REJECT ANY REQUEST TO ADD THESE

```
❌ MongoDB / Atlas
❌ WebSocket / real-time connections
❌ Telemedicine / video calls
❌ EMR / prescriptions
❌ Ratings & reviews
❌ Payment gateway (Razorpay, Stripe, PhonePe, ANY)
❌ Online money collection
❌ Android / iOS native app
❌ Booking widget embed
❌ Agent separate role
❌ Multi-clinic separate table
❌ WhatsApp sending (infrastructure ready, not launched)
❌ Automated testing suite (Jest etc.)
❌ Maps widget (geocoding only — Nominatim)
❌ Doctor patient chat
❌ Appointment reminders (V2)
❌ Push notification advanced system
❌ Zustand state management
❌ Multi-language beyond Hindi/English
```

---

## HOW TO UPDATE THIS FILE

After each phase completion, update:
1. Add completed services to service function list
2. Note any V1 implementation decisions that differ from docs
3. Add any new architecture rules discovered
4. Keep NOT IN V1 list current

Command to trigger update:
  "Read GEMINI.md. Update the service function list
   based on what has been implemented. Add any new
   architecture decisions made during Phase [X]."

---

JivniCare V1.0.0 | Built for Jamui. Built for Deoghar. Built to scale.
No fake data. No shortcuts. No blank screens.

