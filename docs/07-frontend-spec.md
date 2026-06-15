# JivniCare V1.0.0 — Frontend Specification
# Document: 07-frontend-spec.md
# Version: V1.0.0 FINAL

---

## ⚠ STRICT RULES

1. NO prisma import in any page or component file — ever
2. NO business logic in UI components — display only
3. ALL data fetched via internal API routes only
4. ALL forms validated client-side (Zod) + server-side (Zod)
5. ALL loading states use Skeleton — not spinner (except fallback)
6. ALL error states handled — no blank screens ever
7. Mobile-first for patient pages (320px minimum)
8. Responsive for doctor pages (mobile + desktop)
9. Dark mode: system default (prefers-color-scheme)
10. ASK NOTHING — execute exactly as written

---

## 1. TECH SETUP

```bash
# Install Shadcn/ui
npx shadcn@latest init

# Install required components
npx shadcn@latest add button card input label badge
npx shadcn@latest add sheet dialog drawer tabs progress
npx shadcn@latest add toast sonner avatar separator
npx shadcn@latest add skeleton scroll-area command
npx shadcn@latest add dropdown-menu popover

# Install additional packages
npm install @react-pdf/renderer qrcode.react
npm install framer-motion
npm install date-fns
npm install react-hot-toast
```

---

## 2. TAILWIND CONFIG

Update tailwind.config.ts:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          blue:       '#2563EB',
          'blue-hover':'#1D4ED8',
          'blue-active':'#1E40AF',
          green:      '#16A34A',
          'green-hover':'#15803D',
          'green-active':'#166534',
          navy:       '#1B3F6B',
        },
        // Status colors
        status: {
          success:    '#16A34A',
          error:      '#DC2626',
          warning:    '#F59E0B',
          info:       '#2563EB',
        },
        // Background
        surface: {
          primary:    '#F8F9FA',
          card:       '#FFFFFF',
          secondary:  '#F1F5F9',
        },
        // Disabled state
        disabled: {
          bg:         '#E5E7EB',
          text:       '#9CA3AF',
          border:     '#D1D5DB',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        hindi: ['Noto Sans Devanagari', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        sm:      '8px',
        md:      '12px',
        lg:      '16px',
        xl:      '20px',
        '2xl':   '24px',
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        glass:   '0 8px 32px rgba(31,38,135,0.08)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

---

## 3. GLOBAL FONTS SETUP

Add to src/app/layout.tsx:

```typescript
import { Inter, Poppins, Noto_Sans_Devanagari } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

const notoDevanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '600', '700'],
  subsets: ['devanagari'],
  variable: '--font-hindi',
  display: 'swap',
})
```

Font usage rules:
```
Hero headings, CTA buttons:  font-display (Poppins)
Body text, labels, inputs:   font-sans (Inter)
Hindi content:               font-hindi (Noto Sans Devanagari)
```

---

## 4. COLOR TOKEN SYSTEM — COMPLETE

```css
/* All states defined */

/* Primary Brand */
--color-primary:        #2563EB;
--color-primary-hover:  #1D4ED8;
--color-primary-active: #1E40AF;
--color-primary-light:  #EFF6FF;

/* Success */
--color-success:        #16A34A;
--color-success-hover:  #15803D;
--color-success-active: #166534;
--color-success-light:  #F0FDF4;

/* Error */
--color-error:          #DC2626;
--color-error-hover:    #B91C1C;
--color-error-active:   #991B1B;
--color-error-light:    #FEF2F2;

/* Warning */
--color-warning:        #F59E0B;
--color-warning-hover:  #D97706;
--color-warning-active: #B45309;
--color-warning-light:  #FFFBEB;

/* Disabled */
--color-disabled-bg:    #E5E7EB;
--color-disabled-text:  #9CA3AF;
--color-disabled-border:#D1D5DB;

/* Focus Ring */
--color-focus:          #3B82F6;

/* Backgrounds */
--color-bg-primary:     #F8F9FA;
--color-bg-card:        #FFFFFF;
--color-bg-secondary:   #F1F5F9;

/* Text */
--color-text-primary:   #0F172A;
--color-text-secondary: #475569;
--color-text-muted:     #94A3B8;

/* Doctor Status Colors */
--color-available:      #16A34A;  /* green */
--color-break:          #F59E0B;  /* amber */
--color-busy:           #EA580C;  /* orange */
--color-offline:        #6B7280;  /* gray */

/* Queue Badge Colors */
--color-queue-live:     #16A34A;
--color-queue-full:     #DC2626;
--color-queue-closed:   #6B7280;
--color-queue-opening:  #F59E0B;

/* Brand Navy (Admin + QR) */
--color-navy:           #1B3F6B;
```

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 DoctorCard Component

Used in: Search results, Homepage featured

```
Layout (Mobile — List):
┌──────────────────────────────────────┐
│ [Photo 60px] Dr. Name    [Queue Badge]│
│             Speciality · X yrs       │
│             [Verified ✓] [Fee ₹XXX]  │
│             Clinic Name, City        │
│             [Book Now →]             │
└──────────────────────────────────────┘

Layout (Desktop — Card Grid):
┌──────────────────────┐
│ [LIVE QUEUE badge]   │
│ [WALK-INS badge]     │
│ [Photo 80px]         │
│ [Verified ✓]         │
│ Dr. Name             │
│ Speciality · X yrs   │
│ Qualifications       │
│ [Verified Doctor][Language]│
│ 📍 Clinic, Area      │
│ ₹XXX  [Book Visit→]  │
│ ✓ Confirmed Booking  │
└──────────────────────┘

Queue Badge variants:
  🟢 LIVE · X ahead    → green pill
  🔴 Queue Full        → red pill
  ⚫ Clinic Closed     → gray pill
  🟡 Opening Soon      → amber pill

Props:
  doctor: DoctorCardData
  onBook: () => void
  variant: 'list' | 'grid'

Skeleton loading:
  3 lines shimmer for text
  Circle shimmer for photo
  Rectangle shimmer for button
```

### 5.2 SpecialitySelect Component

Used in: Search bar, Doctor registration Step 1

```
Behavior:
  - Click → opens command palette style
  - Mobile: bottom sheet
  - Desktop: dropdown popover
  - Type to filter (client-side, instant)
  - Grouped: Popular | Specialists
  - Shows: icon + name
  - Keyboard: arrow keys + enter
  - Min 1 char to start filtering
  - Clear button (×) when selected

Visual:
┌──────────────────────────────┐
│ 🔍 Search speciality...      │
├──────────────────────────────┤
│ POPULAR                      │
│ 🩺 General Physician         │
│ 👶 Pediatrician              │
│ 🤱 Gynecologist              │
│ 🦴 Orthopedic                │
│ 🦷 Dentist                   │
├──────────────────────────────┤
│ SPECIALISTS                  │
│ 🔬 Dermatologist             │
│ ... (filter to see more)     │
└──────────────────────────────┘

Props:
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
```

### 5.3 QueueBadge Component

Used in: Doctor cards, Doctor profile, Token page

```
Variants:
  live:     bg-green-500  text-white  "🟢 LIVE · X ahead"
  full:     bg-red-500    text-white  "Queue Full"
  closed:   bg-gray-400   text-white  "Clinic Closed"
  opening:  bg-amber-400  text-white  "Opening Soon"
  break:    bg-amber-400  text-white  "On Break"

Props:
  status: 'live' | 'full' | 'closed' | 'opening' | 'break'
  aheadCount?: number
```

### 5.4 TokenStatusCard Component

Used in: Token tracking page

```
Layout:
┌────────────────────────────────┐
│        JivniCare               │
│                                │
│         Your Token             │
│                                │
│            #8                  │  ← 72px font, bold
│                                │
│      Dr. Sharma                │  ← 18px
│      General Physician         │  ← 14px muted
│                                │
│  ┌────────────────────────┐   │
│  │  5 patients ahead      │   │  ← info card
│  │  Currently serving: #3 │   │
│  └────────────────────────┘   │
│                                │
│  [Progress bar]                │  ← 8px height, branded blue
│  3 of 8                        │  ← small, muted
│                                │
│  📍 JivniCare Hospital         │  ← 14px
│     Rajendra Nagar, Jamui      │
│                                │
│  ● Waiting                     │  ← Status dot + text
│                                │
│  [Cancel Booking]              │  ← Outline button, red text
│                                │
│  Get directions ↗              │  ← Text link, not button
└────────────────────────────────┘

Status dot colors:
  BOOKED/AWAITING/READY: amber (waiting)
  CALLED:               green (your turn)
  IN_CONSULTATION:      blue  (with doctor)
  COMPLETED:            gray  (done)
  CANCELLED/EXPIRED:    red   (ended)

Auto-refresh: 30s silent
Cancel button: hidden when CALLED/IN_CONSULTATION/COMPLETED/NO_SHOW/EXPIRED

Props:
  token: TokenStatusData
  onCancel: () => void
```

### 5.5 DoctorStatusToggle Component

Used in: Doctor dashboard

```
Current status shown as pill button
Click → bottom sheet (mobile) / dropdown (desktop)

Options:
  🟢 Available   — "Accept new bookings"
  🟡 On Break    — Text input: "Back in X min"
  🟠 Queue Full  — "Pause new bookings"
  ⚫ Offline     — "Close clinic for today"

Visual feedback:
  Dashboard header changes color based on status
  AVAILABLE:  green tint
  BREAK:      amber tint
  BUSY:       orange tint
  OFFLINE:    gray tint
```

### 5.6 Header Component

```
Patient header (mobile):
┌────────────────────────────────────┐
│ [Logo]          [🔍] [👤] [🔔]     │
└────────────────────────────────────┘
  Logo: 32px height
  Search icon: tap → /search page
  User icon: tap → /profile or /login
  Bell icon: tap → notifications panel

Patient header (desktop):
┌────────────────────────────────────────────────────┐
│ [Logo]  [Search doctors or symptoms...]  [Login]   │
└────────────────────────────────────────────────────┘

Doctor header:
┌────────────────────────────────────┐
│ [Logo]  Dr. Name  [Status pill] [≡]│
└────────────────────────────────────┘

Admin header:
┌────────────────────────────────────┐
│ [Logo] Command Center      [Admin] │
└────────────────────────────────────┘
  Navy background (#1B3F6B)
  White text
```

### 5.7 Footer Component

```
Links (in order):
About Us | Contact Us | Terms of Use | Privacy Policy
Refund & Cancellation | Medical Disclaimer
Doctor Verification Policy | Data Deletion Request
Help & Support

Bottom line:
"© 2026 JivniCare. Bihar Ka Trusted Healthcare Platform."
"JivniCare is a booking platform, not a medical provider."
```

### 5.8 Feedback Patterns

```
INLINE VALIDATION (form fields):
  Show error below field after blur or submit
  Red border + red text + error icon
  Example: "Phone number must be 10 digits"
  DO NOT show before user touches field

TOAST NOTIFICATIONS (success/info):
  Position: top-center (mobile), bottom-right (desktop)
  Duration: 3 seconds
  Examples:
    ✅ "Booking confirmed! Token #8"
    ℹ️ "OTP sent to your phone"
  Library: sonner (from Shadcn)

CONTEXTUAL WARNINGS (recoverable):
  Shown inline in page — not toast
  Amber background card
  Examples:
    "Dr. Sharma is on break. Queue may resume shortly."
    "Only 2 slots remaining today."

CONFIRMATION DIALOGS (high-impact only):
  Modal with explicit confirmation
  Used for: Cancel booking, Delete account, Ban doctor
  Always has: [Cancel] [Confirm action] buttons
  Never auto-close — user must explicitly choose

LOADING STATES:
  Primary: Skeleton loader (shimmer animation)
  Fallback: Spinner (only when skeleton not possible)
  Page transitions: Next.js loading.tsx
```

---

## 6. PAGE SPECIFICATIONS

### 6.1 Homepage (/)

```
Sections (top to bottom):
1. Hero section:
   Desktop: Search bar (full width) + headline
   Mobile:  Headline + [Find a Doctor] button

2. Speciality chips (horizontal scroll on mobile):
   Tier 1 first: GP, Pediatrician, Gynecologist, Orthopedic, Dentist
   Then: Dermatologist, ENT, Ophthalmologist...
   Click → /search?speciality=[name]

3. Featured Doctors:
   "Verified Doctors Near You"
   Desktop: 4-column grid
   Mobile:  Horizontal scroll cards
   Max 8 doctors (Early Partners first, then online)
   [Browse All Doctors →] link

4. How it works:
   3 steps: Search → Book → Visit
   Simple icons, 1 line each

5. Footer

API calls:
  GET /api/public/home
  GET /api/public/specialities
```

### 6.2 Search Page (/search)

```
Layout:
  Sticky search bar at top
  Collapsible filters (mobile: bottom sheet)
  Results list/grid below

Filter panel:
  District:      [Jamui] [Deoghar] (pill toggle)
  Speciality:    SpecialitySelect component
  Fee Range:     [Under ₹200] [₹200-500] [₹500+]
  Gender:        [Any] [Male] [Female]
  Language:      [Hindi] [English] [Bhojpuri] [Maithili]
  Available Now: toggle
  Emergency:     toggle
  [Clear All]

Results:
  Mobile:  DoctorCard list variant
  Desktop: DoctorCard grid variant
  Count: "X doctors found"
  Skeleton: 5 cards while loading
  Empty states: per 06-web-flow.md

API calls:
  GET /api/public/search?...
  Search logged anonymously
```

### 6.3 Doctor Profile (/doctors/[slug])

```
Mobile layout (above fold — no scroll):
  Clinic photo slider (OYO-style, max 3)
  Doctor avatar (60px) with status dot
  Verified badge (shield icon, green)
  Dr. Name (24px, bold)
  Speciality · X years exp
  Clinic Name, City/District
  ₹XXX Consultation Fee
  Queue Status Badge
  "X patients served via JivniCare"
  [Book Appointment Now] (full-width button)

Below fold:
  [Share ⬆] button (top right — copy link)
  About the Doctor
  Education & Qualifications (pill tags)
  Expertise & Tags
  Diseases Treated
  Languages (pill tags)
  Clinic section:
    Clinic name + address
    Opening hours (from schedule)
    Owner: [name]
    📍 [View on Map] (Nominatim link)
  Other doctors at same clinic (if any)

Share functionality:
  Copy URL to clipboard
  Show QR code preview (patient can screenshot)

API calls:
  GET /api/public/doctors/[slug]
  30s polling for queue status only
```

### 6.4 Book Appointment (/book?doctorId=)

```
Full booking confirmation screen:
  Doctor summary (photo + name + speciality)
  Token visualization (railway-style)
  Fee breakdown (display only)
  Consent checkbox (required)
  [Confirm Booking] button

If not logged in:
  Login bottom sheet opens first
  After OTP → returns to this page

Loading state:
  Skeleton for token visualization
  Disabled button while processing

Success:
  Brief success animation
  Auto-redirect to /token/[id] after 2s

API calls:
  POST /api/patient/book
  POST /api/patient/validate-booking (pre-check)
```

### 6.5 Token Tracking (/token/[id])

```
Per TokenStatusCard component spec (Section 5.4)
30s silent auto-refresh
No manual refresh button needed

API calls:
  GET /api/patient/tokens/[id]   (polling every 30s)
```

### 6.6 My Bookings (/bookings)

```
Two tabs: [Active] [Past]

Active tab:
  Each booking card:
    Token # | Doctor | Status badge | [Track] [Cancel]
  Empty: "No active bookings" + [Find a Doctor]

Past tab:
  Each booking card:
    Token # | Doctor | Date | Status (completed/cancelled/expired)
  Empty: "No past bookings"

API calls:
  GET /api/patient/bookings
```

### 6.7 Patient Profile (/profile)

```
Sections:
  Profile photo (avatar with initials fallback)
  Name (editable)
  Phone (not editable)
  Email (editable)
  Language preference (Hindi/English toggle)
  [Save Changes]

Danger zone:
  [Request Data Deletion] → confirmation dialog
    → Email sent to admin
    → In-app: "Deletion request received. 30 days processing."

API calls:
  GET /api/auth/me
  PUT /api/patient/profile
```

### 6.8 Doctor Dashboard (/doctor/dashboard)

```
Header: "Good [morning/afternoon], Dr. [Name]"
Status toggle (prominent)

Stats row:
  Today's Bookings | Completed | No-Shows | Emergency

Platform value card:
  "₹2,999 Fee Waived This Month"
  "47 Patients Served"
  "Top 3 in Jamui"

Quick actions:
  [Go to Queue] [Add Walk-in] [Download QR Sticker]

Verification status banner (if PENDING_REVIEW):
  Amber banner: "Profile under review. We'll notify you."

Registration incomplete banner (if step < 4):
  Blue banner: "Complete your profile to go live"
  [Complete Profile →]

API calls:
  GET /api/doctor/dashboard
  GET /api/auth/me
```

### 6.9 Doctor Queue (/doctor/queue)

```
Per Flow D3 in 06-web-flow.md

Two tabs with count badges
Token list with action buttons
Real-time: 30s polling
Walk-in button always visible
Emergency tab always visible (even if 0)

API calls:
  GET /api/doctor/queue  (30s polling)
  PUT /api/doctor/queue/advance
  POST /api/doctor/queue/walkin
  PUT /api/doctor/tokens/[id]
```

### 6.10 Admin Dashboard (/admin)

```
Command Center header (navy background)

Stats grid (30s refresh):
  Doctors Online | Patients in Queue | Emergency | Bookings Today

System health indicator:
  ✅ All systems operational
  ⚠ Degraded performance
  ❌ System issue

Queue health table:
  Doctor | Queue | Emergency | Status | [View Queue]

Search insights panel:
  Top 10 searches | Zero result queries

Doctor requests panel:
  Recent leads from empty search

API calls:
  GET /api/admin/stats           (30s)
  GET /api/admin/queue-health    (30s)
  GET /api/admin/search-insights
```

---

## 7. RESPONSIVE BREAKPOINTS

```
Mobile:   320px - 767px  → Patient primary target
Tablet:   768px - 1023px → Intermediate
Desktop:  1024px+        → Doctor dashboard primary

CSS approach: Mobile-first (min-width breakpoints)
  Default styles = mobile
  md: = tablet
  lg: = desktop
```

---

## 8. DARK MODE

```
System default (prefers-color-scheme: dark)
User cannot manually toggle in V1

Dark mode token overrides:
  --color-bg-primary:  #0F172A
  --color-bg-card:     #1E293B
  --color-bg-secondary:#1E293B
  --color-text-primary:#F8FAFC
  --color-text-secondary:#94A3B8

Shadcn handles dark mode automatically
Tailwind dark: class approach
```

---

## 9. LANGUAGE TOGGLE

```
Default: Based on browser language
         Hindi if Hindi browser detected
         English otherwise

Toggle: In account settings (not visible in nav)

Implementation:
  next-intl library
  Locales: en, hi
  Messages: src/messages/en.json, src/messages/hi.json

Hindi content uses font-hindi (Noto Sans Devanagari)
English content uses font-sans (Inter)

Symptom map supports Hindi queries regardless of UI language
```

---

## 10. PERFORMANCE TARGETS

```
Homepage:        < 2s load (LCP)
Search results:  < 500ms after typing stops
Doctor profile:  < 1.5s load
Token status:    < 800ms load
API responses:   < 300ms (P95)

Image optimization:
  Next.js Image component always
  Cloudinary auto-format + quality
  Blur placeholder while loading

Code splitting:
  Next.js automatic per page
  Heavy components lazy loaded
```

---

## 11. ACCESSIBILITY

```
All buttons: aria-label when icon-only
All images: alt text always
Form inputs: label always linked
Color: never use color alone to convey meaning
Keyboard: all interactions keyboard navigable
Focus: visible focus ring (#3B82F6) on all interactive elements
ARIA live regions: for 30s polling updates (screen reader safe)
```

---

## 12. PWA INSTALL PROMPT

```
Show "Add to Home Screen" prompt:
  Timing: After patient completes first booking
  NOT on first visit (too early)

Prompt text:
  "Install JivniCare for quick access"
  "Track your appointment from home screen"
  [Install] [Maybe Later]

iOS: Show instructions (iOS doesn't support auto-prompt)
  "Tap [share icon] → Add to Home Screen"
```

---

## 13. ARCHITECTURE COMPLIANCE RULES

```
RULE AR-01: No business logic in any page.tsx or component file
RULE AR-02: No prisma import outside src/lib/ folder
RULE AR-03: No direct fetch() to external APIs from UI
RULE AR-04: All API calls use typed fetch wrapper
RULE AR-05: All forms use react-hook-form + zodResolver
RULE AR-06: JWT never stored client-side
RULE AR-07: All sensitive data from server components only
RULE AR-08: Use apiSuccess()/apiError() in all route handlers
RULE AR-09: Never show raw error messages from server
RULE AR-10: All state transitions via service layer only
```

---

Document complete. Every component, page, and pattern specified.
Last updated: June 2026 | JivniCare V1.0.0

