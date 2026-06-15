# JivniCare V1.0.0 — Web Flow & User Journey Specification
# Document: 06-web-flow.md
# Version: V1.0.0 FINAl
---

## ⚠ STRICT RULES

1. EVERY page transition must match flows defined here
2. DO NOT add extra steps to any flow — friction kills conversion
3. DO NOT show empty screens — every state has a defined UI
4. DO NOT redirect patient to login before they search/browse
5. Login popup appears ONLY at booking step — not before
6. ALL error states defined — implement exactly as written
7. ASK NOTHING — execute exactly as written

---

## 1. PATIENT FLOWS

### Flow P1 — First Time Visit (Homepage)

```
User opens jivnicare.com
        ↓
Homepage loads
  Desktop: Full search bar visible in hero
           "Book Doctor Appointments" headline
           Speciality grid (Tier 1 first)
           Featured doctors (Early Partners first)
  Mobile:  Search icon in sticky header
           Hero: headline + "Find a Doctor" CTA button
           Speciality chips (horizontal scroll)
           Featured doctors (card list)
        ↓
No login required to browse
```

### Flow P2 — Search & Discovery

```
Patient types in search bar (min 2 chars)
        ↓
Real-time results (debounced 300ms)
  Layer 1: Symptom map check (Hindi + English)
  Layer 2: PostgreSQL FTS — 8 fields
  Layer 3: Score + rank (online first)
  Layer 4: Hard filters applied
  Layer 5: Results displayed
        ↓
Results page:
  Mobile:  List view — doctor cards
  Desktop: Card grid
  Each card shows: Photo + Name + Speciality +
                   Fee + Queue badge + Verified badge
        ↓
Filter options (collapsible on mobile):
  District / Speciality / Fee Range /
  Gender / Language / Available Today / Emergency Only
        ↓
Speciality selection:
  Searchable dropdown — type to filter
  Grouped: Popular (Tier 1) → Regular (Tier 2) → Specialist (Tier 3)

EMPTY STATES:
  Query + no results:
    "No doctors found for '[query]'"
    "Request a Doctor" form → name + phone + district + speciality
    → Saved in doctor_requests table → admin sees as lead

  Filters too tight:
    "No doctors match these filters"
    [Clear All Filters] button

  Area no doctors yet:
    "Doctors are joining soon in [district]"
    [Get Notified] → phone number saved → notified when doctor joins
```

### Flow P3 — Doctor Profile

```
Patient clicks doctor card
        ↓
Doctor Profile Page loads
        ↓
ABOVE FOLD (mobile — no scroll needed):
  ┌────────────────────────────────┐
  │ [Clinic Photo Slider — 3 max] │ ← OYO-style swipe
  │ [Doctor Avatar] [Status dot]  │
  │ Dr. Name  [Verified ✓]        │
  │ Speciality · X yrs exp        │
  │ Clinic Name, City             │
  │ ₹XXX Consultation Fee         │
  │ [Queue Status Badge]          │
  │ X patients served via JivniCare│
  │ [Book Appointment Now] ←CTA   │
  └────────────────────────────────┘

BELOW FOLD:
  About the Doctor
  Education & Qualifications
  Expertise Tags + Diseases Treated
  Languages Spoken
  Clinic Section:
    Address + Owner Name
    Timing (from schedule)
    [Share Profile] button → copy link + QR preview
  
QUEUE STATUS DISPLAY:
  AVAILABLE:  🟢 LIVE · X ahead
  BREAK:      🟡 On Break · [breakMessage]
  BUSY:       🟠 Queue Full · [Join Waitlist]
  OFFLINE:    ⚫ Currently Unavailable · [Get Notified]

DOCTOR OFFLINE RULE:
  Profile ALWAYS visible (never hidden to patient)
  Booking blocked when OFFLINE/BUSY
  "Get Notified" → phone saved in waitlist table
```

### Flow P4 — Booking Flow

```
Patient clicks "Book Appointment Now"
        ↓
IF not logged in:
  Login popup appears (bottom sheet mobile, modal desktop)
  Enter phone → OTP → verify → back to same doctor profile
  (Patient does NOT lose their place)
        ↓
IF logged in:
  Booking confirmation screen appears
  ┌────────────────────────────────┐
  │ Book Appointment               │
  │ Dr. [Name] — [Speciality]     │
  │ [Clinic Name], [City]         │
  │                                │
  │ Your Token: #[X]               │  ← Railway style
  │ [Token visualization]          │
  │ ██████░░░░░░  X of Y slots     │
  │ X patients ahead of you        │
  │                                │
  │ Consultation Fee:  ₹[Fee]      │
  │ Convenience Fee:   ~~₹29~~ FREE│
  │ Total Payable:     ₹[Fee]      │
  │ 💊 Pay at Clinic               │
  │                                │
  │ ☑ I understand this is an      │
  │   in-clinic booking. JivniCare │
  │   is a booking platform.       │
  │                                │
  │ [Confirm Booking]              │
  └────────────────────────────────┘
        ↓
Booking confirmed:
  Success animation (brief)
  In-app notification created
  Redirect → Token Status Page

BOOKING BLOCKED STATES:
  Queue full:     "No slots today. Join Waitlist?"
                  → Same speciality other doctor suggested first
  Already booked: "You already have a booking with Dr. [Name]"
  3 limit reached:"You have 3 active bookings today (max)"
  Doctor offline: "Dr. [Name] is not accepting bookings"
```

### Flow P5 — Token Status Page

```
Patient lands on /token/[id]
        ↓
┌────────────────────────────────┐
│        JivniCare               │
│                                │
│         Your Token             │
│                                │
│            #8                  │  ← HERO — large, bold
│                                │
│      Dr. Sharma                │
│      General Physician         │
│                                │
│  ┌──────────────────────────┐  │
│  │  5 patients ahead        │  │
│  │  Currently serving: #3   │  │
│  └──────────────────────────┘  │
│                                │
│  ████████░░░░░░  3 of 8        │  ← Progress bar only
│                                │
│  📍 JivniCare Hospital         │
│     Rajendra Nagar, Jamui      │
│                                │
│  Status: Waiting  🟡           │
│                                │
│  [Cancel Booking]              │  ← Only if cancellable
│                                │
│  Get directions ↗              │  ← Subtle text link
└────────────────────────────────┘

Auto-refresh: Every 30 seconds (silent — no flash)
NO estimated time shown — only position
Status changes:
  CALLED:    Status = "Your Turn! 🟢" + push notification
  COMPLETED: Status = "Visit Complete ✅"
  NO_SHOW:   Status = "Marked as No Show"
  CANCELLED: Status = "Booking Cancelled"
  EXPIRED:   Status = "Token Expired"
```

### Flow P6 — Cancellation Flow

```
Patient clicks [Cancel Booking]
        ↓
Confirmation dialog appears:
  "Cancel your appointment with Dr. [Name]?"
  "Token #[X] will be cancelled."
  [Keep Booking] [Yes, Cancel]
        ↓
If confirmed:
  Token status → CANCELLED
  In-app notification: "Booking cancelled successfully"
  Redirect → My Bookings

CANCELLATION BLOCKED STATES:
  CALLED:           No cancel button shown
  IN_CONSULTATION:  No cancel button shown
  COMPLETED:        No cancel button shown
  NO_SHOW:          No cancel button shown
  EXPIRED:          No cancel button shown
```

### Flow P7 — My Bookings

```
/bookings page
        ↓
Active Bookings tab:
  All BOOKED/AWAITING/PAYMENT_PENDING/READY/CALLED/IN_CONSULTATION tokens
  Each shows: Token #, Doctor, Clinic, Status badge, [Track] [Cancel]

Past Bookings tab:
  All COMPLETED/NO_SHOW/CANCELLED/EXPIRED tokens
  Each shows: Token #, Doctor, Date, Status

Empty state:
  "No bookings yet"
  [Find a Doctor] button → Search page
```

### Flow P8 — Waitlist Flow

```
Queue full → Patient clicks [Join Waitlist]
        ↓
System checks same-speciality doctors:
  IF another doctor available with open slots:
    Show suggestion card:
    "Dr. [Name] — [Speciality] — [X slots available]"
    [Book with Dr. Name] [Stay on Waitlist]
  IF no other doctor available:
    Waitlist form:
    Phone pre-filled (if logged in)
    "Notify me when Dr. [Name] has slots"
    [Join Waitlist]
        ↓
Saved in waitlist table
Notified via push notification when doctor comes AVAILABLE
```

---

## 2. DOCTOR FLOWS

### Flow D1 — Registration (4 Steps)

```
Doctor opens jivnicare.com → "Register as Doctor" link
        ↓
STEP 1 — Basic Info (Lead captured HERE)
  Fields: Full Name, Phone Number, Speciality (searchable dropdown)
  Action: [Get OTP] → verify → account created → PENDING_ACTIVATION
  ✅ Lead saved even if doctor stops here

STEP 2 — Clinic & Owner Info
  Fields:
    Clinic/Hospital Name
    Clinic Address (full)
    City, District (Jamui/Deoghar only)
    Pincode
    Owner Name, Owner Mobile
    Receptionist 1: Name + Phone (optional)
    Receptionist 2: Name + Phone (optional)
    Receptionist 3: Name + Phone (optional)
  [Save & Continue]

STEP 3 — Professional Details + Documents
  Fields:
    Gender
    Medical Registration Number
    Qualifications (add multiple: MBBS, MD, MS...)
    Experience Years
    Bio / About
    Languages Spoken (multi-select)
    Expertise Tags (add)
    Diseases Treated (add — for search)
    Procedures Available (add — for search)
    Profile Photo (Cloudinary upload)
    Clinic Photos (max 3, Cloudinary upload)
    Documents (max 10: certificates, registration, ID proof)
    Emergency Facility: [Yes] [No]
    If Yes: Emergency Capacity (number)
  [Submit for Verification]
  → verificationStatus = PENDING_REVIEW
  → Admin receives notification

STEP 4 — Schedule (can skip, do from dashboard)
  Fields:
    Weekly Schedule:
      Mon: [✓] Start: [09:00] End: [14:00]
      Tue: [✓] Start: [09:00] End: [14:00]
      ...
    Booking Window:
      Bookings open from: [08:00]
      Bookings close at:  [13:00]
    Daily Token Limit: [30]
    Consultation Fee: [500]
  [Complete Setup]
  → registrationComplete = true

PROGRESS INDICATOR:
  Step 1 ● → Step 2 ● → Step 3 ● → Step 4 ●
  Saved progress — can resume anytime from dashboard
```

### Flow D2 — Dashboard

```
Doctor logs in → /doctor/dashboard
        ↓
Dashboard shows:
  ┌─────────────────────────────────────┐
  │ Good morning, Dr. [Name]            │
  │ Status: [OFFLINE ▼] (toggle)        │
  ├─────────────────────────────────────┤
  │ Today's Summary                     │
  │ 12 Booked  |  3 Completed  |  0 No-show│
  ├─────────────────────────────────────┤
  │ Platform Value                      │
  │ ₹2,999 Fee Waived | Top 3 in City  │
  │ 47 Patients This Month              │
  └─────────────────────────────────────┘
        ↓
Quick actions:
  [Go to Queue] [Add Walk-in] [Download QR]
```

### Flow D3 — Queue Management

```
Doctor goes to /doctor/queue
        ↓
Two tabs:
  [Regular Queue (12)] | [Emergency Queue (2)]
        ↓
REGULAR QUEUE TAB:
  Current token highlighted (CALLED/IN_CONSULTATION)
  ┌─────────────────────────────────────┐
  │ #5 — Raju Kumar   🟢 CALLED        │
  │ 🌐 Online booking                   │
  │ [Mark Complete] [Mark No-Show]      │
  ├─────────────────────────────────────┤
  │ #6 — Priya Singh  ⏳ READY         │
  │ 🚶 Walk-in                          │
  ├─────────────────────────────────────┤
  │ #7 — Amit Verma   📋 BOOKED        │
  │ 🌐 Online booking                   │
  └─────────────────────────────────────┘
  [+ Add Walk-in Patient]
  [Call Next Patient]

EMERGENCY QUEUE TAB:
  E1 — [Patient Name] — Emergency
  E2 — [Patient Name] — Emergency
  [+ Add Emergency Patient]

TOKEN BADGES:
  🌐 = Online booking (ONLINE)
  🚶 = Walk-in (WALKIN)
  Status colors per token status

BIDIRECTIONAL ADVANCE:
  Click [Call Next]:
    → Previous IN_CONSULTATION = auto COMPLETED
    → Next READY token = CALLED
  Click [Mark Complete]:
    → Current = COMPLETED
    → Next READY token = auto CALLED
```

### Flow D4 — Walk-in Add

```
Doctor clicks [+ Add Walk-in Patient]
        ↓
Modal/sheet opens:
  Patient Name (required)
  Patient Phone (required)
  Patient Address (required)
  Queue: [Regular] [Emergency]
  [Add to Queue]
        ↓
Token created with type=WALKIN
Appears in queue with 🚶 badge
```

### Flow D5 — Status Toggle

```
Doctor clicks status toggle on dashboard
        ↓
Bottom sheet / dropdown:
  🟢 Available — Accept new bookings
  🟡 On Break  — [Enter break message: "Back in 30 min"]
  🟠 Queue Full — Stop new bookings
  ⚫ Offline   — Clinic closed

On BREAK selection:
  → breakMessage saved
  → isAcceptingBookings = false
  → Profile shows desaturated + break message
  → Existing booked patients get push notification:
    "Dr. [Name] is on a break. Your token is still valid."

On OFFLINE selection:
  → currentStatus = OFFLINE
  → isAcceptingBookings = false
  → Profile desaturated
  → New bookings blocked
  → Profile still visible (patients can still discover)
```

### Flow D6 — QR Sticker Download

```
Doctor clicks [Download QR] from dashboard
        ↓
GET /api/doctor/qr-sticker
        ↓
PDF generated with @react-pdf/renderer:
  Page 1: A4 size (for print)
  Page 2: 10x10cm sticker size

Both pages contain:
  Navy background (#1B3F6B)
  JivniCare logo (white)
  Dr. [Name] (white, bold, large)
  [Speciality]
  JVC[001]
  Clinic Name, Area
  [QR CODE — white on navy]
    Links to: jivnicare.com/doctors/[slug]
  "Scan to Book Appointment"
  jivnicare.com

PDF downloads automatically
```

---

## 3. ADMIN FLOWS

### Flow A1 — Admin Login

```
Admin goes to jivnicare.com/admin
        ↓
Admin login page (NOT same as patient login)
  Enter phone → OTP → verify
        ↓
TOTP prompt:
  "Enter 6-digit code from Google Authenticator"
  [______] [Verify]
        ↓
Admin dashboard
```

### Flow A2 — Doctor Verification

```
Admin sees pending doctor in list
        ↓
Clicks doctor name → Doctor Detail page
        ↓
Sees:
  Personal info
  Clinic info
  Professional details
  Documents (viewable)
  Medical registration number
        ↓
Admin actions:
  [Verify Doctor] → verificationStatus = VERIFIED
                 → canShowOnPublic = true
                 → Resend email: "Your profile is live"

  [Reject] → Reason input (required)
           → verificationStatus = REJECTED
           → Doctor email: rejection reason + resubmit instructions
           → Doctor can edit + re-submit
```

### Flow A3 — Admin Onboard Doctor

```
Admin clicks [+ Add Doctor] in admin panel
        ↓
Multi-step form (same as doctor registration)
Admin fills Steps 1-3 on behalf of doctor
        ↓
[Submit] clicked
        ↓
System:
  Creates doctor account (PENDING_ACTIVATION)
  Sends SMS to doctor phone (Twilio):
  "JivniCare pe aapka account ready hai.
   Verify karein: jivnicare.com/verify?token=[token]
   Link valid for 48 hours."
        ↓
Doctor clicks link → OTP verify → VERIFIED → Live
        ↓
IF 48 hours expire without verification:
  Status stays PENDING_ACTIVATION
  Admin can resend activation
```

### Flow A4 — Doctor Ban

```
Admin clicks [Ban Doctor] on doctor detail page
        ↓
Confirmation dialog:
  "Ban Dr. [Name]? This will:
   • Hide public profile immediately
   • Disable doctor login
   • Block new bookings"
  Reason input (required)
  [Cancel] [Confirm Ban]
        ↓
System executes in order:
  1. verificationStatus = SUSPENDED
  2. canShowOnPublic = false
  3. isAcceptingBookings = false
  4. currentStatus = OFFLINE
  5. Delete all auth sessions
  6. Show active tokens to admin
        ↓
Admin sees modal:
  "Dr. [Name] has [X] active tokens.
   What to do with them?"
  [Cancel All Tokens] [Close Queue] [Transfer] (manual)
        ↓
AuditLog created
In-app notification to affected patients
```

### Flow A5 — Platform Monitoring

```
Admin dashboard — 30s auto-refresh
        ↓
Stats panel:
  Doctors Online Right Now: [X]
  Patients in Queue Now:    [X]
  Emergency Patients:       [X]
  Bookings Today:           [X]
  System Health:            ✅ / ⚠ / ❌
        ↓
Queue Health section:
  All active doctors listed
  Each row: Doctor Name | Queue Count | Emergency | Status
  Click row → see that doctor's live queue
        ↓
Search Insights:
  Top 10 searches this week
  Zero-result searches (fix opportunities)
        ↓
Doctor Requests:
  Leads from empty search state
  Name | Phone | District | Speciality | Contacted ✓/✗
```

---

## 4. SYSTEM FLOWS

### Flow S1 — 04:00 AM IST Cron

```
Vercel Cron triggers at 22:30 UTC (= 04:00 AM IST)
        ↓
Step 1: Find all BOOKED/AWAITING_ARRIVAL tokens
        with date < today's logical date
        → Update status to EXPIRED

Step 2: Find all ACTIVE daily_queues
        with date < today's logical date
        → Update status to CLOSED

Step 3: Find all doctors with currentStatus != OFFLINE
        → Reset to OFFLINE

Step 4: Update stats:
        lifetimePatientsServed += COMPLETED tokens count
        jivnicarePatientsServed += COMPLETED tokens count

Step 5: Delete search_logs older than 90 days

Step 6: Create AuditLog entry:
        action: SYSTEM, entityType: CRON,
        newValue: { expiredTokens: X, closedQueues: Y }
```

### Flow S2 — Queue Cache

```
Patient/Doctor requests queue data
        ↓
Check Redis: queue:{queueId}
        ↓
Cache HIT (< 30s old):
  → Return cached data immediately

Cache MISS:
  → Fetch from PostgreSQL
  → Store in Redis with 30s TTL
  → Return data

On ANY token state change:
  → Immediately DELETE queue:{queueId} from Redis
  → Next request fetches fresh from DB
```

### Flow S3 — Doctor Registration Activation (48hr)

```
Admin onboards doctor
        ↓
Activation token created (UUID, stored in Redis)
TTL: 48 hours
        ↓
Doctor clicks link → verifies OTP
        ↓
Redis token validated → deleted
Doctor status → VERIFIED → canShowOnPublic = true
        ↓
IF 48hr passed:
  Link shows: "This link has expired"
  "Contact JivniCare support"
  Admin can resend from admin panel
```

### Flow S4 — Emergency Facility Request

```
Doctor goes to dashboard → Settings
Clicks [Enable Emergency Facility]
        ↓
IF first time:
  Form: Emergency Capacity (number)
  [Submit Request]
  → emergencyPendingRequest = true
  → Admin notified
        ↓
Admin reviews → Approves/Rejects:
  Approved:
    isEmergencyEnabled = true
    emergencyCapacity = [number]
    emergencyApprovedAt = now
    emergencyApprovedBy = adminId
    emergencyPendingRequest = false
    Doctor notification: "Emergency facility approved"

  Rejected:
    emergencyPendingRequest = false
    Doctor notification: "Emergency request not approved. Reason: [X]"

IF doctor already has emergency enabled:
  [Modify Capacity] → same approval flow
```

---

## 5. ERROR STATES — ALL PAGES

```
Network error:
  Toast: "Connection failed. Check your internet."
  [Retry] button

Server error (5xx):
  Toast: "Something went wrong. Please try again."
  Sentry captures automatically

Not found (404):
  Custom 404 page:
  "Page not found"
  [Go to Homepage]

Unauthorized (401):
  Redirect to /login
  After login: redirect back to original page

Forbidden (403):
  Custom page: "Access denied"
  [Go to Homepage]

Rate limited (429):
  Toast: "Too many requests. Please wait."
  Show countdown timer

Maintenance:
  /maintenance page
  "JivniCare is under maintenance. Back soon."
  Estimated time (if known)

Doctor not found (slug invalid):
  "This doctor profile is not available"
  [Search other doctors]

Queue full at booking moment:
  "All slots just got filled. Join the waitlist?"
  [Join Waitlist] [Search Other Doctors]
```

---

## 6. CONSENT FLOWS

```
AT SIGNUP (one-time, cannot proceed without):
  ☑ "I agree to Terms of Use and Privacy Policy"
      → Links open in new tab
  ☑ "I confirm I am booking for myself or
     as a guardian for a family member"

AT BOOKING (every booking):
  ☑ "I understand JivniCare is a booking platform,
     not a medical provider. I will pay the
     consultation fee directly at the clinic."
     → Checkbox required before [Confirm Booking]
```

---

## 7. PAGE → API MAPPING (Complete)

```
Homepage:
  GET /api/public/home
  GET /api/public/specialities
  GET /api/public/districts

Search:
  GET /api/public/search?q=&district=&speciality=...

Doctor Profile:
  GET /api/public/doctors/[slug]

Book Appointment:
  POST /api/patient/book
  POST /api/patient/validate-booking (pre-check)

My Bookings:
  GET /api/patient/bookings

Token Tracking:
  GET /api/patient/tokens/[id]   (30s polling)

Cancel Token:
  DELETE /api/patient/tokens/[id]

Waitlist:
  POST /api/patient/waitlist

Doctor Dashboard:
  GET /api/doctor/dashboard
  PUT /api/doctor/status

Doctor Queue:
  GET /api/doctor/queue          (30s polling)
  PUT /api/doctor/queue/advance
  POST /api/doctor/queue/walkin
  PUT /api/doctor/tokens/[id]

Doctor QR:
  GET /api/doctor/qr-sticker

Doctor Export:
  GET /api/doctor/export?from=&to=

Admin Dashboard:
  GET /api/admin/stats           (30s polling)
  GET /api/admin/queue-health    (30s polling)

Admin Doctors:
  GET /api/admin/doctors
  GET /api/admin/doctors/[id]
  POST /api/admin/doctors/[id]/verify
  POST /api/admin/doctors/[id]/reject
  POST /api/admin/doctors/[id]/ban
  POST /api/admin/doctors/onboard

Admin Insights:
  GET /api/admin/search-insights
  GET /api/admin/pricing

Health Check:
  GET /api/health
```

---

Document complete. Every flow defined. No empty states missing.
Last updated: June 2026 | JivniCare V1.0.0

