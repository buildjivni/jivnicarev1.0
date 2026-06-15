# JivniCare V1.0.0 — Product Requirements Document (PRD)
# Document: 05-prd.md
# Version: V1.0.0 FINAL

---

## ⚠ STRICT RULES

1. DO NOT build any feature not listed in V1 SCOPE section
2. DO NOT add any feature that fails the V1 Founder Principle test
3. EVERY feature must serve patient, doctor, OR admin — not just "nice to have"
4. IF in doubt whether to build something — DO NOT build it
5. V2 features are listed — do not implement them in V1

---

## 1. PRODUCT VISION

```
JivniCare is a queue-first, same-day doctor booking platform
built for Tier-2/3 cities in Bihar and Jharkhand.

It eliminates the two biggest problems in local healthcare:
  Problem 1: Patients wait hours at clinic without knowing queue position
  Problem 2: Doctors have no system to manage patient flow efficiently

JivniCare gives every patient a token number from home.
Every doctor a digital queue system.
Every clinic a professional online presence.
```

---

## 2. MISSION STATEMENT

```
"Making quality healthcare accessible and organized
 for every family in Jamui and Deoghar."
```

---

## 3. TAGLINE

```
"Book Doctor Appointments"
— Clean, professional, English
— Used in: Hero section, PWA name, browser tab title
— NOT: Hindi tagline in hero (language toggle available in account)
```

---

## 4. TARGET MARKET — V1

```
Geography:    Jamui + Gaya +Muzaffarpur+Darbhanga+Siwan +Rohtash + Bhagalpur (Bihar) + Deoghar (Jharkhand)  ONLY
              Hard-coded in search filters
              No other district in V1

Doctors:      Local clinic doctors, hospital-based doctors
              General physicians, specialists
              Tech comfort: low-medium (system must be simple)

Patients:     Age: No restriction (guardian can book for minor)
              Language: Hindi primary, English available
              Device: Android phone (mid-range Rs 8,000-15,000)
              Internet: Low-medium bandwidth areas
```

---

## 5. V1 SUCCESS METRICS

```
Primary:   10 verified doctors live within 3 months of launch
Secondary: 500 registered patients within 3 months
Quality:   Zero critical bugs in first 30 days
           Zero patient complaints about wrong queue/booking
           Zero data loss incidents
```

---

## 6. USER ROLES — COMPLETE

### 6.1 Patient
```
Who:        Anyone with a phone number
Can do:
  - Search doctors by symptom, name, speciality, area
  - View doctor profile + queue status
  - Book appointment (max 3 active/day)
  - Track token status in real-time
  - Cancel booking (only in BOOKED/AWAITING/PAYMENT_PENDING/READY)
  - View My Bookings history
  - Edit profile (name, email)
  - Request data deletion
  - Join waitlist when queue full
  - Request a doctor (lead form when no doctor found)
Cannot do:
  - Book for another user (guardian books on their own account)
  - Pay online (pay at clinic only)
  - Rate or review doctor (V2)
  - See other patients' tokens
  - Access doctor or admin features
```

### 6.2 Doctor
```
Who:        Verified medical professional
Can do:
  - Register via multi-step form (4 steps)
  - Manage own profile (fee, bio, schedule, photo)
  - Set daily token limit + booking window timing
  - Toggle status: AVAILABLE / BREAK / BUSY / OFFLINE
  - View regular queue + emergency queue (2 tabs)
  - Call next patient / mark complete / mark no-show
  - Add walk-in patient to queue
  - Add internal notes on patient token (not visible to patient)
  - View patient history
  - Export patient data as PDF (custom date range, max 31 days)
  - Download branded QR sticker PDF (A4 + sticker size)
  - Request emergency facility enable (goes to admin for approval)
  - Update schedule, fee, daily limit anytime (audit logged)
  - Login on 3 devices simultaneously
Cannot do:
  - See other doctors' queues
  - Access admin panel
  - Modify patient accounts
  - Set their own verification status
  - Override queue state machine rules
```

### 6.3 Admin (JivniCare Superadmin)
```
Who:        JivniCare team — 1 superadmin + invited admins
Can do:
  - Full platform monitoring dashboard (30s refresh)
  - View all active queues across all doctors
  - Click any doctor → see their live queue
  - Verify / reject doctor with reason
  - Ban doctor (profile hidden + login disabled)
  - Manage banned doctor's active tokens (cancel/transfer/close)
  - Onboard doctor directly (admin fills form → doctor OTP verifies)
  - Approve / reject emergency facility requests
  - Invite other admins (email invite → TOTP setup)
  - Set platform pricing per doctor (fee, discount, tier, free until)
  - View search insights (top searches + zero result queries)
  - View doctor requests (leads from empty search state)
  - View patient list
  - Support search (find any user by phone)
  - System metrics
Cannot do:
  - Ban patients (V1 — only doctor ban)
  - Modify queue tokens directly (only via service layer)
  - Change doctor's consultation fee without doctor knowing
    (admin sets platform fee — doctor sets consultation fee)
```

### 6.4 Field Agent (V1 — no separate role)
```
Who:        JivniCare team member visiting clinics
How:        Uses admin credentials on mobile browser
Can do:     Fill doctor registration form on doctor's behalf
            Doctor receives OTP on their phone → verifies themselves
Cannot do:  Access any other admin feature
Note:       Admin must be careful — share credentials only with trusted agents
            V2 will have proper agent role
```

---

## 7. PLATFORM — COMPLETE

```
V1:   Mobile-first web app (PWA)
      - Installable on Android home screen ("Add to Home Screen")
      - Works offline partially (cached pages)
      - Push notifications via service worker
      - No Play Store dependency
      - URL: jivnicare.com

V2:   Android app + iOS app
      - Same backend API
      - Same business logic
      - Native shell only (React Native or Flutter)
      - Launch only after V1 validates:
        user adoption, doctor onboarding, appointment flow

Architecture: API-first from day 1
      - All features built as APIs
      - Future: doctor website widgets, embed buttons
        can use same APIs without backend changes
```

---

## 8. COMPLETE FEATURE LIST — V1

### 8.1 Patient Features
```
F01: Phone OTP login/signup (no password)
F02: Doctor search — symptom, name, speciality, area (Hindi+English)
F03: Search filters — district, speciality, fee range, gender, language,
     available today, emergency only
F04: Searchable speciality dropdown (20 specialities, tier-ordered)
F05: Doctor profile page — full details above fold on mobile
F06: Queue status on doctor card — live badge (LIVE/Queue Full/Closed/Opening Soon)
F07: Railway-style booking flow — see token position before confirming
F08: Book appointment (creates token, in-app confirmation)
F09: Token status page — token number hero, X patients ahead, progress bar
F10: My Bookings page — all active + past bookings
F11: Cancel token (allowed states: BOOKED/AWAITING/PAYMENT_PENDING/READY)
F12: Join waitlist when queue full → same-speciality doctor suggested first
F13: "Request a Doctor" form (phone + name + district + speciality) → lead capture
F14: Patient profile edit (name, email)
F15: Language toggle (Hindi/English) — set at account creation
F16: Browser push notifications (doctor status change, token called)
F17: In-app notifications (booking confirm, queue updates)
F18: Data deletion request (DPDP Act 2023 compliance)
F19: Consent capture (Terms + Medical disclaimer at signup + booking)
```

### 8.2 Doctor Features
```
F20: Multi-step registration (4 steps — lead captured at step 1)
F21: Profile management (photo, bio, fee, qualifications, languages)
F22: Clinic info management (photos max 3, address, owner info)
F23: Document upload (max 10 files via Cloudinary)
F24: Schedule management (weekly JSON, booking window, daily limit)
F25: Status toggle (AVAILABLE/BREAK/BUSY/OFFLINE) with break message
F26: Regular queue tab — token list with ONLINE/WALKIN badge per token
F27: Emergency queue tab — E1, E2, E3... separate sequence
F28: Call Next / Mark Complete / Mark No-Show actions
F29: Bidirectional queue advance (Complete → next auto-CALLED)
F30: Add walk-in patient (naam + phone + address → token created)
F31: Internal notes on patient (never shown to patient)
F32: Patient history with search
F33: PDF export (patient data, custom range, max 31 days)
F34: QR sticker PDF download (A4 + sticker size, branded)
F35: Emergency facility request (goes to admin for approval)
F36: Dashboard metrics (bookings today, patients served, platform savings)
F37: Verification status page (pending/approved/rejected with reason)
F38: 3-device login support
```

### 8.3 Admin Features
```
F39: Platform monitoring dashboard (all queues, online doctors, bookings today)
F40: Per-doctor queue view (click → see live queue)
F41: Doctor list with verification status filter
F42: Doctor verification (approve with VERIFIED status)
F43: Doctor rejection (with reason → doctor can re-submit)
F44: Doctor ban (immediate — profile hidden, login disabled)
F45: Admin onboard doctor (form → doctor OTP verifies → 48hr expiry)
F46: Emergency facility approve/reject
F47: Platform pricing control (monthly fee, per booking, discount %, tier, free until)
F48: Search insights (top searches + zero result queries)
F49: Doctor requests list (leads from empty search)
F50: Patient list + support search
F51: System metrics page
F52: Invite new admin (email → TOTP setup)
F53: Audit log viewer
```

### 8.4 System Features
```
F54: 04:00 AM IST daily cron (expire tokens, close queues, update stats)
F55: Search log anonymous analytics (90-day auto-delete)
F56: Queue Redis cache (30s TTL, immediate invalidation on state change)
F57: /api/health endpoint (DB + Redis check)
F58: Sentry error monitoring
F59: PWA manifest + service worker
F60: Security headers + CORS
F61: Rate limiting (per-endpoint)
F62: Audit logging (all roles, all actions)
F63: Archive on delete (soft delete → archived_records table)
F64: First admin setup route (one-time, auto-disables)
```

---

## 9. LEGAL PAGES — ALL REQUIRED

### Footer Links (in order):
```
About Us
Contact Us
Terms of Use           ← Page required before launch
Privacy Policy         ← Page required before launch
Refund & Cancellation  ← Page required before launch
Medical Disclaimer     ← Page required before launch
Doctor Verification Policy
Data Deletion Request
Help & Support
```

### Consent Collection:
```
At Signup:
  ☑ "I agree to Terms of Use and Privacy Policy"
  ☑ "I confirm I am booking for myself or as guardian"

At Booking:
  ☑ "I understand JivniCare is a booking platform,
     not a medical provider. I will pay at clinic."
```

### Compliance:
```
DPDP Act 2023:  Data deletion option in profile settings
IT Act 2000:    Platform liability limited via terms
IP Protection:  Logo + name + content in Terms of Use
Medical:        JivniCare is not a hospital/doctor
                (Medical Disclaimer on every booking)
```

---

## 10. OUT OF SCOPE — V1

### Features NOT in V1 (DO NOT BUILD):
```
❌ Telemedicine / video consultation
❌ Online payment (Razorpay, Stripe, PhonePe, UPI)
❌ Subscription billing / auto-deduction
❌ Ratings & reviews
❌ Prescriptions / EMR
❌ Insurance integration
❌ Android / iOS native app
❌ Booking widget embed
❌ Agent separate role + login
❌ Maps widget (geocoding only)
❌ WhatsApp immediate (infrastructure ready, not launched)
❌ SMS DLT (no promotional SMS — only transactional OTP)
❌ Push notification advanced (basic only)
❌ Automated testing suite
❌ Multi-language (Hindi + English only in V1)
❌ Bhojpuri / Maithili UI (in symptom map only)
❌ Doctor chat with patient
❌ Appointment reminders (V2)
❌ Analytics dashboard for doctor (basic metrics only)
```

---

## 11. V1 FOUNDER PRINCIPLE

Every feature must pass ALL 5 tests before building:

```
Test 1: Does it reduce patient confusion?
Test 2: Does it reduce receptionist workload?
Test 3: Does it help doctors serve patients faster?
Test 4: Does it improve operational visibility?
Test 5: Can it be operated by a small founder-led team?

IF ANY ANSWER IS NO → Do not build in V1
```

---

## 12. PAYMENT MODEL — DISPLAY ONLY

```
Patient side:
  Consultation Fee:         ₹[Doctor Fee]    (always shown)
  Platform Convenience Fee: ~~₹29~~ FREE 🎉  (strikethrough)
  Savings Message:          "You're saving ₹29 — Early Access Benefit"
  Total Payable:            ₹[Doctor Fee]
  Payment Method:           "Pay at Clinic / Hospital"
  Subtext:                  "No online payment required."

Doctor side (dashboard):
  Platform Fee Waived:      ₹2,999 Saved
  Total Value Generated:    ₹X,XXX Saved in N months
  Search Visibility:        Top X in City
  Queue Efficiency:         XX min/day Saved

Admin pricing control:
  monthlyFee:      ₹2,999 (display)
  perBookingFee:   ₹29    (display)
  discountPercent: 100%   (Early Partner — actual charge = ₹0)
  partnerTier:     EARLY_PARTNER
  freeUntil:       31 Dec 2026

Early Partner Program:
  First 20 verified doctors
  Benefits: 100% discount + Gold Badge + Priority Search + Dashboard Savings

NO: Razorpay, Stripe, PhonePe, UPI, invoices, settlement, auto-deduction
```

---

## 13. DOCTOR PROFILE — ABOVE FOLD (MOBILE)

Patient sees this WITHOUT scrolling:
```
1. Doctor Photo (or JivniCare avatar placeholder)
2. Doctor Name + Verified Badge (shield icon)
3. Speciality
4. Experience (X years)
5. Clinic Name + City/District
6. Consultation Fee (₹XXX)
7. Current Status (color-coded)
8. "X patients ahead" (if AVAILABLE)
9. Patients served via JivniCare (social proof)
10. Primary CTA: "Book Appointment Now" button
```

Doctor status visual:
```
AVAILABLE: Full color profile + green dot + "Available Now"
BREAK:     20% desaturated + amber dot + "On Break — Back soon"
BUSY:      Full color + orange dot + "Queue Full" + Join Waitlist
OFFLINE:   Desaturated (not B&W) + gray dot + "Currently Unavailable"
```

---

## 14. SEARCH EXPERIENCE

```
Homepage (desktop): Full search bar — symptoms/doctor/area + district selector
Homepage (mobile):  Search icon in header → tap → search page

Search results:
  Mobile:  List view (fast scroll, thumb-friendly)
  Desktop: Card grid (visual, scannable)

Doctor card shows:
  Photo + Name + Speciality + Fee + Queue badge
  Queue badge: 🟢 LIVE · X ahead · / 🔴 Queue Full / ⚫ Closed / 🟡 Opening Soon

Empty states:
  No results + query:    "Request a Doctor" form (lead capture)
  Filters too tight:     "Clear Filters" button
  Area no doctors yet:   "Notify Me" button (phone capture)

Waitlist (queue full):
  Same speciality → suggest another available doctor first
  If none available → "Join Waitlist" → notify when doctor available
```

---

## 15. V2 ROADMAP

```
Phase 4A: Doctor subscription via Razorpay recurring
Phase 4B: Per-booking charges
Phase 4C: Premium listings
Phase 5:  Android + iOS apps (same backend)
Phase 6:  Telemedicine
Phase 7:  EMR + Prescriptions
Phase 8:  Insurance integration
Phase 9:  Multi-city expansion (beyond Jamui + Deoghar)
Phase 10: WhatsApp booking flow
```

---

## 16. DOMAIN + URLS

```
Main app:     jivnicare.com
Admin:        jivnicare.com/admin//jvc-26 (NOT subdomain — security)
Doctor:       jivnicare.com/doctors/[slug]
API:          jivnicare.com/api/...
Health:       jivnicare.com/api/health
```

---

Document complete. Reference this for all product decisions.
Last updated: June 2026 | JivniCare V1.0.0

