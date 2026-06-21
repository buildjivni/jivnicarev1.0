# Booking Integrity Fix — Hard Cap + Auto-Skip Timeout
**Status:** FINAL — V1 scope. Patches Phase 4 (Queue Engine & Atomic Transactions).
**Reason this exists:** During Phase 4 review, a real-world gap was identified — `dailyTokenLimit` alone cannot distinguish real patients from curious/test/abuse bookings, and an earlier proposed fix (soft-hold overbooking buffer) was found to break the platform's core promise of a reliable token-number/ETA. This document replaces that earlier idea with the final, simpler design.

---

## 1. What changes (and what does NOT)

**No change:** `totalTokens >= dailyTokenLimit` remains a hard cap. No overbooking buffer, no soft-hold multiplier. This part of Phase 4 is already correct and stays as-is.

**New addition — Auto-Skip on Call-Timeout:**
- When a doctor/receptionist clicks **Call Next**, the token transitions to `CALLED` with a timestamp recorded.
- If that token does not progress to `IN_CONSULTATION` within **10 minutes**, the *next* `Call Next` click automatically:
  1. Marks the stale `CALLED` token as `NO_SHOW` (terminal state — already exists in the state machine, no new state needed).
  2. Calls the next token in sequence.
  3. Frees that capacity slot immediately, which can now flow into the existing FIFO waitlist auto-book logic (already built in Phase 4) — a real waiting patient gets the slot fast, not at the end of the day.
- **This requires zero new UI elements for the receptionist/doctor.** It is logic embedded inside the existing `Call Next` button handler — the same single button they already use. They will see an info-toast (e.g. *"Patient (Token #42) marked No-Show after 10 min — now calling Token #43"*) but make no extra clicks and have no new screen to learn. This preserves the simplicity of the familiar paper-register workflow they're used to — nothing should make the new system feel more complex or less comfortable than the old manual process.

**New addition — Range-based ETA display (not exact-time):**
- Patient-facing token confirmation and tracking screens must display an **estimated arrival window** (e.g. *"Estimated arrival window: 4:30 PM – 5:30 PM"*), not a single exact time.
- This is a presentation-layer change only — it sets honest expectations and avoids implying false precision, especially since no-show timeouts mean earlier patients' slots can free up faster than a naive fixed-time estimate would suggest (which works in the waiting patient's favor, not against them).

---

## 2. Why this approach (for future reference / Gemini CLI compliance checks)

- An earlier proposal (booking up to ~1.3x `dailyTokenLimit` as a "soft hold," only fully confirming patients on arrival+payment) was rejected: it could let real, paying-intent patients receive late token numbers that become unreliable if many soft-held bookings are no-shows discovered only late in the day. This breaks the core product promise of an honest, trackable queue position.
- The Hard Cap + Auto-Skip Timeout design instead keeps the token count always trustworthy (never overbooked) while still solving the original problem (abusive/curious bookings wasting real capacity) — because no-show capacity is now reclaimed within ~10 minutes of a token's turn, not discovered at end-of-day.
- This design requires **no payment gateway integration** — confirmation remains purely physical arrival + receptionist check-in, consistent with the existing ₹0/cash-at-clinic model. See `v2-future/01-deferred-features.md` for why a paid convenience fee was considered and explicitly deferred, not adopted, for this same problem.

---

## 3. Implementation Notes for Antigravity

- `queue.service.ts` — extend the `Call Next` handler: before calling the next token, check if the currently-`CALLED` token (if any) has `calledAt` older than 10 minutes. If so, transition it to `NO_SHOW` first, then proceed with calling the next token as normal. This is a single function modification, not a new service.
- No new Prisma fields are required — `calledAt` timestamp should already exist (or be trivially derivable from existing `QueueToken` status-change auditing) from Phase 4's implementation; confirm this field exists before implementing, add it if missing.
- Patient-facing ETA range can be computed client-side or service-side from `patientsAhead` × average-consultation-time (if that average isn't already tracked, use a simple configurable constant, e.g. 8 minutes/patient, as a v1 estimate — refine in V2 with real historical data).
- This patches Phase 4 — re-run the existing atomic-booking concurrency test after this change to confirm no regression, plus add a new test: simulate a `CALLED` token aging past 10 minutes, call `Call Next` again, assert the stale token becomes `NO_SHOW` and the next token is called correctly.
