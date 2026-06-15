# JivniCare V1.0.0 — Payment System Plan
# Document: 09-payment-system.md
# Version: V1.0.0 FINAL


---

## ⚠ STRICT RULES — CRITICAL

1. ABSOLUTELY NO payment gateway integration — Razorpay, Stripe, PhonePe, UPI, NONE
2. ABSOLUTELY NO online money collection of any kind
3. ABSOLUTELY NO subscription billing or auto-deduction
4. ABSOLUTELY NO invoice generation for actual transactions
5. ABSOLUTELY NO payment settlement logic
6. THIS IS A DISPLAY-ONLY SYSTEM — show numbers, collect nothing
7. ALL payment UI is informational only — no payment processing
8. IF any developer adds payment gateway — revert immediately
9. V2 roadmap exists — do not implement V2 payment in V1
10. ASK NOTHING — execute exactly as written

---

## 1. SYSTEM OVERVIEW

```
JivniCare V1 Payment Model:
  Type:     Display Only — Pay at Clinic
  Gateway:  NONE
  Online:   NONE
  Billing:  NONE
  Revenue:  NONE (V1 is free for all)

How it works:
  Patient books → sees fee display → pays doctor directly at clinic
  Doctor gets patients → sees platform value → no actual billing
  Admin controls pricing display → sets discount to 100% → everyone pays ₹0

Purpose of payment display:
  1. Patient: Transparency (know fee before visiting)
  2. Doctor:  Perceived value (see what they're saving)
  3. Admin:   Future monetization groundwork (infrastructure ready)
  4. Trust:   Professional platform feel
```

---

## 2. PATIENT SIDE — DISPLAY SPEC

### 2.1 Booking Page Fee Display

```
┌─────────────────────────────────────┐
│ Payment Summary                     │
├─────────────────────────────────────┤
│ Consultation Fee          ₹500      │
│                                     │
│ Platform Convenience Fee            │
│ ~~₹29~~  FREE 🎉                    │  ← strikethrough + green FREE
│                                     │
│ ─────────────────────────────────── │
│ Total Payable             ₹500      │
│                                     │
│ 💊 Pay at Clinic / Hospital         │
│    No online payment required.      │
│    Pay directly when you visit.     │
│                                     │
│ 🎉 You're saving ₹29                │
│    Early Access Benefit             │
└─────────────────────────────────────┘
```

### 2.2 Display Rules

```
Consultation Fee:
  Source:    doctor.consultationFee (from DB)
  Display:   "₹[amount]" always shown
  If 0:      "₹0 (Free Consultation)"
  Never:     Hide or modify this amount

Platform Convenience Fee:
  Source:    PlatformPricing.perBookingFee
  Default:   ₹29
  Display:   ALWAYS show as strikethrough: ~~₹29~~
  After:     "FREE 🎉" in green (#16A34A)
  Formula:   actualCharge = perBookingFee × (1 - discountPercent/100)
             = 29 × (1 - 100/100) = 29 × 0 = ₹0
             → Shows FREE when discountPercent = 100

Total Payable:
  Formula:   consultationFee + actualCharge
             = consultationFee + 0 = consultationFee
  Display:   "₹[consultationFee]" only
  NEVER:     Add any hidden charges

Savings Message:
  Text:      "You're saving ₹[perBookingFee] — Early Access Benefit"
  Color:     #16A34A (success green)
  Icon:      🎉

Payment Method Label:
  Icon:      💊
  Text:      "Pay at Clinic / Hospital"
  Subtext:   "No online payment required. Pay directly when you visit."
```

### 2.3 Implementation

```typescript
// src/lib/services/payment.service.ts

export function calculateDisplayFee(
  consultationFee: number,
  perBookingFee: number,
  discountPercent: number
): {
  consultationFee:  number
  perBookingFee:    number
  discountPercent:  number
  actualCharge:     number   // Always 0 in V1 (100% discount)
  totalPayable:     number
  savingsAmount:    number
  isFree:           boolean
} {
  const actualCharge = perBookingFee * (1 - discountPercent / 100)
  const totalPayable = consultationFee + actualCharge
  const savingsAmount = perBookingFee - actualCharge

  return {
    consultationFee,
    perBookingFee,
    discountPercent,
    actualCharge,
    totalPayable,
    savingsAmount,
    isFree: actualCharge === 0,
  }
}

// THIS FUNCTION MUST NEVER:
// - Process any payment
// - Call any payment gateway
// - Store any transaction
// - Generate any invoice
// It only calculates display values
```

---

## 3. DOCTOR SIDE — VALUE DISPLAY SPEC

### 3.1 Dashboard Metrics

```
Doctor dashboard shows these metrics (display only):

┌──────────────────────────────────────────┐
│ 💰 Platform Value This Month             │
├──────────────────────────────────────────┤
│ Total Bookings:     47 patients          │
│ Platform Fee Waived: ₹2,999             │
│ Per-Booking Saved:  ₹1,363 (47 × ₹29)  │
│ Total Value:        ₹4,362 Saved        │
│                                          │
│ Search Visibility:  Top 3 in Jamui       │
│ Queue Efficiency:   34 min/day Saved     │
└──────────────────────────────────────────┘
```

### 3.2 Doctor Value Calculation

```typescript
export function calculateDoctorValue(
  jivnicarePatientsServed: number,
  monthlyFee: number,
  perBookingFee: number,
  discountPercent: number
): {
  totalBookings:        number
  monthlyFeeSaved:      number   // What they would pay without discount
  perBookingSaved:      number   // Total per-booking fees saved
  totalValueGenerated:  number   // Combined display value
  actualCharged:        number   // Always 0 in V1
} {
  const discount = discountPercent / 100
  const monthlyFeeSaved   = monthlyFee * discount
  const perBookingSaved   = perBookingFee * jivnicarePatientsServed * discount
  const totalValueGenerated = monthlyFeeSaved + perBookingSaved

  return {
    totalBookings:        jivnicarePatientsServed,
    monthlyFeeSaved,
    perBookingSaved,
    totalValueGenerated,
    actualCharged:        0,  // V1 — always 0
  }
}
```

### 3.3 Doctor Normal Pricing Display (for reference)

```
What doctors see in their dashboard (display only):

Normal Platform Fee:    ₹2,999 / month
Per Booking Fee:        ₹29 / booking
Your Discount:          100% (Early Partner)
You Pay:                ₹0

This information is shown to help doctors understand
the value they are receiving as Early Partners.
NO actual billing occurs.
```

---

## 4. EARLY PARTNER PROGRAM

### 4.1 Program Rules

```
Who:          First 20 verified doctors on JivniCare
Tier:         EARLY_PARTNER
Benefits:
  ✅ 100% discount on all platform fees
  ✅ ₹0 monthly fee (normally ₹2,999)
  ✅ ₹0 per-booking fee (normally ₹29)
  ✅ Gold "⭐ Early Partner" badge on profile
  ✅ Priority search ranking (partnerTier boost in scoring)
  ✅ Dashboard savings display
  ✅ Public profile badge

Free Until:   31 December 2026 (set by admin)

After 20 doctors:
  Tier:       STANDARD
  Discount:   100% (still free in V1 launch phase)
  Badge:      No special badge
  Admin controls when to change discount
```

### 4.2 Admin Sets Early Partner

```
Admin panel → Doctor pricing → Edit:
  monthlyFee:      ₹2,999
  perBookingFee:   ₹29
  discountPercent: 100
  partnerTier:     EARLY_PARTNER
  freeUntil:       2026-12-31

System auto-applies 100% discount
Doctor sees "₹0 · Early Partner Benefit" in dashboard
```

### 4.3 Early Partner Badge Display

```
On search result card:
  ┌─────────────────────┐
  │ ⭐ Early Partner    │  ← Gold gradient pill, top-right
  │ Dr. [Name]          │
  └─────────────────────┘

Badge style:
  Background: linear-gradient(135deg, #F59E0B, #D97706)
  Text:       "⭐ Early Partner"  white 11px 600
  Border-radius: 999px
  Padding:    2px 8px

On doctor profile:
  Shown below verified badge
  Same styling
```

---

## 5. ADMIN PRICING CONTROL

### 5.1 Admin Can Set Per Doctor

```
Fields in admin panel:
  Monthly Fee:         ₹[amount]   (display reference)
  Per Booking Fee:     ₹[amount]   (display reference)
  Discount Percent:    [0-100]%    (0 = full price, 100 = free)
  Partner Tier:        EARLY_PARTNER / STANDARD / PREMIUM
  Free Until:          [date picker]
  Is Active:           [toggle]

Examples:
  Early Partner:
    monthlyFee = 2999, perBookingFee = 29,
    discountPercent = 100, partnerTier = EARLY_PARTNER
    → Doctor pays ₹0, sees "100% saved"

  Standard (future V2):
    monthlyFee = 2999, perBookingFee = 29,
    discountPercent = 0, partnerTier = STANDARD
    → Doctor would pay full price
    → NOT collected in V1 — display only still

  Custom deal:
    monthlyFee = 2999, perBookingFee = 29,
    discountPercent = 50, partnerTier = STANDARD
    → Doctor sees 50% savings display
```

### 5.2 Admin Pricing API

```typescript
// PUT /api/admin/pricing
// Body: { doctorId, monthlyFee, perBookingFee, discountPercent, partnerTier, freeUntil }

// Service: src/lib/services/admin.service.ts
export async function updateDoctorPricing(
  adminId: string,
  doctorId: string,
  pricing: {
    monthlyFee:      number
    perBookingFee:   number
    discountPercent: number
    partnerTier:     PartnerTier
    freeUntil?:      Date
  }
) {
  // Validate: discountPercent 0-100
  // Upsert PlatformPricing record
  // Update doctor.partnerTier
  // Create AuditLog (action: UPDATE, entityType: PlatformPricing)
  // Return updated pricing

  // NEVER: Process any payment
  // NEVER: Charge any card
  // NEVER: Send payment link
}
```

---

## 6. DATABASE MODEL

```prisma
model PlatformPricing {
  id              String      @id @default(uuid())
  doctorId        String      @unique
  monthlyFee      Float       @default(2999)    // Display only
  perBookingFee   Float       @default(29)       // Display only
  discountPercent Int         @default(100)      // 100 = free
  partnerTier     PartnerTier @default(EARLY_PARTNER)
  freeUntil       DateTime?                      // Display reference
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  doctor          Doctor      @relation(fields: [doctorId], references: [id])

  @@map("platform_pricing")
}

// NOTE: This table stores DISPLAY values only
// No actual transactions are processed
// No payment processor is connected
// discountPercent = 100 means ₹0 actual charge (but ₹0 is never collected anyway)
```

---

## 7. PATIENT → DOCTOR → ADMIN FLOW

```
PATIENT:
  1. Searches doctor
  2. Sees consultation fee on card (₹500)
  3. Goes to booking page
  4. Sees fee breakdown:
     - Consultation: ₹500
     - Platform fee: ~~₹29~~ FREE
     - Total: ₹500
  5. Confirms booking
  6. Visits doctor
  7. Pays ₹500 directly at clinic (cash or however doctor accepts)
  8. Done — JivniCare never touched money

DOCTOR:
  1. Receives booking notification
  2. Manages queue via dashboard
  3. Sees monthly value display: "₹2,999 Fee Waived"
  4. Sees bookings count: "47 Patients This Month"
  5. Never receives invoice from JivniCare
  6. Never pays JivniCare anything (V1)

ADMIN:
  1. Sets pricing for each doctor (display values)
  2. Assigns partner tiers
  3. Monitors platform growth
  4. Sees total bookings (proxy for platform value)
  5. Never processes any payment
  6. Never receives any payment (V1)
```

---

## 8. WHAT IS EXPLICITLY NOT INCLUDED

```
❌ Razorpay SDK or API
❌ Stripe SDK or API
❌ PhonePe SDK or API
❌ PayU SDK or API
❌ CCAvenue SDK or API
❌ UPI collection (any form)
❌ QR code for payment (only QR for booking)
❌ Bank transfer / NEFT / IMPS
❌ Subscription billing
❌ Auto-deduction / recurring charges
❌ Invoice PDF for transactions
❌ Payment receipts
❌ Refund processing
❌ Payment settlement
❌ Tax calculation (GST etc.)
❌ Revenue reporting
❌ Transaction history
❌ Payment failure handling
❌ Webhook from payment gateway
❌ PCI compliance (not needed — no payments)
❌ SSL for payment (standard SSL sufficient)
```

---

## 9. V2 PAYMENT ROADMAP

```
Phase 4A — Doctor Subscription (V2):
  Tool:      Razorpay Recurring
  What:      Doctor pays monthly subscription
  Amount:    ₹2,999/month (or custom per tier)
  Flow:      Admin enables billing → Doctor pays via Razorpay
             → Webhook confirms → Subscription active
  Note:      All infrastructure ready in V1 (PlatformPricing table)
             Just need to add Razorpay integration + webhook handler

Phase 4B — Per Booking Charges (V2+):
  Tool:      Razorpay
  What:      ₹29 per confirmed booking
  Flow:      Auto-deduct from doctor's registered account
  Note:      Will require new payment_methods table

Phase 4C — Premium Listings (V2+):
  What:      Doctors pay for featured placement
  Amounts:   TBD

Phase 5 — Patient Convenience Fee (V3):
  What:      Patient pays ₹[X] convenience fee online
  Tool:      Razorpay / PhonePe
  Requires:  DLT registration + PCI compliance
```

---

## 10. REFUND & CANCELLATION POLICY (DISPLAY)

```
Since JivniCare collects no money in V1:

Patient cancels booking:
  → Token cancelled in system
  → No refund needed (nothing was paid to JivniCare)
  → Patient may or may not get refund from doctor
    (doctor's own policy — not JivniCare's concern in V1)

Refund & Cancellation page (footer link):
  Content:
    "JivniCare is a booking platform. We do not collect
     any payment from patients.
     
     All consultation fees are paid directly to the doctor
     at the clinic. For refund queries related to consultation
     fees, please contact the clinic directly.
     
     Booking cancellation: You can cancel your token from
     the app before your turn is called. Cancellation is
     free — no charges apply."
```

---

## 11. MEDICAL DISCLAIMER (Footer + Booking)

```
Footer page content:
  "JivniCare is a technology platform that connects patients
   with healthcare providers. We are NOT a hospital, clinic,
   or medical provider.

   Medical advice, diagnosis, and treatment are the sole
   responsibility of the individual doctor. JivniCare does
   not endorse or guarantee any medical advice provided
   by doctors listed on our platform.

   In case of medical emergency, please call 112 or visit
   the nearest hospital immediately. Do not rely on this
   platform for emergency medical care."

Shown at booking:
  Compact version as checkbox text:
  "I understand JivniCare is a booking platform,
   not a medical provider. I will pay at clinic."
```

---

## 12. TERMS OF USE — KEY POINTS

```
Platform limitation:
  JivniCare provides booking technology only
  Not responsible for medical outcomes

Doctor responsibility:
  All medical advice is doctor's sole responsibility
  JivniCare verifies credentials — not medical quality

Patient responsibility:
  Accurate information provided
  Cancel if cannot attend
  Pay consultation fee at clinic

Account suspension triggers:
  Fake bookings / spam
  Fraudulent information
  Abuse of platform

IP Protection:
  JivniCare logo, name, and content are protected
  Cannot be reproduced without permission
```

---

Document complete. Payment system fully specified — display only.
Last updated: June 2026 | JivniCare V1.0.0

