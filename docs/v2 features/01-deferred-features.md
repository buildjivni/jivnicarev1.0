# V2 — Deferred Features
**Status:** FUTURE SCOPE — explicitly NOT part of V1. Coding agents must not implement anything in this file during V1 development. This file exists so V2 planning has documented context and rationale, not as a build instruction.

---

## 1. Convenience Fee (small, abuse-deterrent + revenue, NOT V1)

### Decision
A small convenience fee (indicative range ₹10–20, to be finalized with real V2 data) is deferred to V2. It is explicitly **not** implemented in V1.

### Why this was considered
During V1 planning, a concern was raised: with `dailyTokenLimit` as a hard cap and no cost to booking, the platform has no way to distinguish real patients from curious/testing users or deliberate abuse (people booking slots with no intent to show up), which could deny capacity to genuine patients on a busy day.

### Why it was decided this should be V1=NO / V2=YES
1. **Conflicts with the V1 Early Partner Program.** V1's ₹0 convenience fee / ₹0 platform fee model exists specifically to make onboarding frictionless for both doctors and patients during the trust-building phase. Introducing any fee in V1 raises the barrier to adoption right when adoption-rate is the most important thing to learn.
2. **V1's real goal is product-market-fit validation, not monetization.** A fee — even a small one — would suppress the very "curious/testing" usage that provides valuable early adoption data (search behavior, drop-off points, which specialities get tried). Filtering this out too early makes V1 harder to learn from.
3. **Payment gateway integration is itself a significant scope addition**, explicitly excluded from V1 per `05-prd.md`'s Future Version (V2+) list (no Razorpay/Stripe/UPI in V1, no payment libraries installed). Introducing a fee in V1 would require building this anyway.
4. **The abuse/no-show problem this fee was meant to solve has an alternative V1-native solution that doesn't require payment at all** — see `booking-integrity-fix.md` (Hard Cap + Auto-Skip Timeout, 10-minute call-timeout auto-marks stale tokens `NO_SHOW` and reclaims capacity immediately for the next real patient). Because this already solves the capacity-waste problem for free, the convenience fee's purpose in V2 shifts from "abuse prevention" to "revenue generation + light commitment signal" — a different, lower-pressure goal that can be pursued once the platform already has established trust and traction.

### V2 Implementation Guidance (for when this is picked up)
- Fee should be set **low enough to function as light validation/commitment signal, not as the primary abuse-prevention mechanism** — that problem is already solved for free by the auto-skip-timeout logic, so the fee doesn't need to be high enough to deter abuse on its own.
- Prefer a low-cost gateway path (UPI-first) over card-based gateways to keep transaction-cost overhead low for the platform, since margins will still be thin at this stage.
- Revisit pricing only with real V1 usage data (booking volume, no-show rate post-auto-skip-fix, doctor feedback) rather than guessing upfront.
- Consider whether the fee should be charged to the patient, absorbed by the platform, or shared with the doctor — this is a business-model decision to make at V2 planning time, not assumed here.

---

## 2. Other Previously-Identified V2 Items (carried over for reference)

- `freeUntil` subscription-expiry enforcement (locking/downgrade logic) — field exists in V1 schema but has no enforcement logic. See `01-backend-schema.md` for the stored field; actual enforcement logic is V2 scope.
- WhatsApp Meta API integration, video consultations/telemedicine, EMR/prescriptions, ratings/reviews, multi-clinic support — per `05-prd.md`'s existing Future Version (V2+) list, unchanged.
