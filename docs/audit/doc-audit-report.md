# JivniCare — Pre-Implementation Documentation Audit Report
# Version: V1.0.0
# Date: June 18, 2026

---

## 1. Executive Summary

- **Overall Spec Health:** Excellent. The specifications are highly detailed, cohesive, and provide clear step-by-step guidance for patient, doctor, and admin workflows.
- **Top 3 Pre-Implementation Risks:**
  1. **Source Code Mismatch (Missing Framework):** The repository lacks Next.js 14 and UI framework code. The `package.json` contains only Prisma and TypeScript dependencies, and no Next.js/React folder structure (`src/`, `app/`, etc.) exists yet.
  2. **Timezone Handling on Logical Dates:** The logical date timezone logic for the 04:00 AM IST cron boundary is described at a high level but lacks database-level instructions (e.g., UTC server vs IST local offset mapping), presenting a risk of database index mismatches.
  3. **Doctor Vacation/Offline Operational Risk:** In V1, doctor vacation/holidays rely entirely on a manual `OFFLINE` status toggle by clinic staff rather than a calendar override. This presents an operational risk of patients booking appointments for days the doctor is not present.

---

## 2. Document Inventory

| Filename | Type | Scope Stated & Coverage Description |
| :--- | :--- | :--- |
| `GEMINI.md` | Spec / Rules | Tech stack, folder structure, 4-layer architecture rules, queue engine rules, auth/security parameters, and V2 exclusions. |
| `docs/01-backend-schema.md` | Database / Spec | Technical Prisma schema definition, custom PostgreSQL sequence, seed data arrays, token state machine rules, and queue rules. |
| `docs/02-security-access.md` | Security / Spec | Auth mechanisms, rate limits, PII application-level encryption rules, data deletion SOP, and doctor NMC registration verification SOP. |
| `docs/03-search-engine.md` | Search / Spec | 5-layer search pipeline, scoring rules, symptom-to-speciality mapping dictionary, empty state variants, and search logging logic. |
| `docs/04-trd.md` | Architecture / TRD | Project directory tree, API routes list, atomic booking transaction contracts, and Logical Date cron specifications. |
| `docs/05-prd.md` | Product / PRD | Product requirements, user personas (Patient, Doctor, Admin), feature metrics list, and V2-deferred features lists. |
| `docs/06-web-flow.md` | User Flow / Spec | Patient, doctor, and admin web flow steps, PWA prompt rules, error states, and V1 doctor vacation manual offline flow. |
| `docs/07-frontend-spec.md` | Frontend / Spec | Wireframe/visual specs for patient, doctor, and admin panels (including the new doctor verification views). |
| `docs/08-design-ui-ux.md` | Design / UI-UX | Color palette, typography system, layout spacing, logo asset placement rules, and reference site comparison. |
| `docs/09-payment-system.md` | Pricing / Spec | Informational pay-at-clinic pricing layout, strike-through convenience fee rules, doctor value widgets, and disclaimers. |
| `docs/10-deployment-devops.md` | Deployment / DevOps | Hosting platform, Mumbai region pinning, pgBouncer connection pooling, env setup rules, and backup policies. |

---

## 3. Topic Cross-Reference Map

| Topic | Primary Stated Coverage | Stated Location(s) | Completeness / Detail Level |
| :--- | :--- | :--- | :--- |
| **User Roles & Auth** | Patient OTP (2Factor.in), Doctor/Admin Google OAuth, single-admin setup. | `docs/02-security-access.md`, `docs/04-trd.md`, `GEMINI.md` | **Complete** (Single Admin model locked). |
| **Booking & Scheduling** | Slots, sequences, cancellation,Logical Date boundaries, and atomic booking transactions. | `docs/01-backend-schema.md`, `docs/04-trd.md`, `docs/06-web-flow.md` | **Partial** (Timezone mappings lack code implementation details). |
| **Notifications** | OTP SMS, PWA push, emails, triggers. | `docs/02-security-access.md`, `docs/04-trd.md`, `GEMINI.md` | **Partial** (Templates and silent-fail retry policies are high-level). |
| **Booking Analytics** | Search logs metrics, doctor dashboard value calculations. | `docs/03-search-engine.md`, `docs/09-payment-system.md` | **Complete** (Formulas and query filters are fully defined). |
| **Data Model** | 14 original tables + 4 audit resolved tables (`Admin`, `BackupCode`, `RateLimitLog`, `ConsentLog`). | `docs/01-backend-schema.md`, `prisma/schema.prisma` | **Complete** (Model schemas and back-relations are fully aligned). |
| **API Contracts** | Route mappings, `/api/v1/` namespacing, and rate limits. | `docs/04-trd.md`, `docs/02-security-access.md` | **Partial** (Request/response payloads are high-level). |
| **Non-Functional Specs** | Indian country boundaries, scale references, and AES-256-GCM encryption. | `docs/02-security-access.md`, `docs/03-search-engine.md` | **Complete** (Compliance, rate limits, and encryption rules are detailed). |
| **Deployment & DevOps** | Region ap-south-1 pinning, pgBouncer pooling, Vercel/Neon deployment. | `docs/10-deployment-devops.md` | **Complete** (DevOps environment and RPO/RTO parameters are mapped). |

---

## 4. Overlap Detection

| Topic | Stated Files | Agreement Level | Detail / Analysis |
| :--- | :--- | :--- | :--- |
| **Admin Setup & Auth** | `01-backend-schema.md` (Table 15), `02-security-access.md` (Admin Auth), `04-trd.md` (API Routes), `07-frontend-spec.md` (TOTP setup) | **Fully Agree** | The multi-admin onboarding and setup API routes have been completely removed. The specifications now consistently describe a single-admin record using Google OAuth + TOTP setup with no invite flows. |
| **SMS Gateway** | `02-security-access.md` (SMS OTP), `04-trd.md` (API route), `GEMINI.md` (Auth rules) | **Fully Agree** | All files specify 2Factor.in as the sole OTP provider for patient authentication and doctor onboarding verification. |
| **Doctor Availability Status** | `01-backend-schema.md`, `02-security-access.md`, `04-trd.md` (4-state model), `06-web-flow.md` | **Fully Agree** | All files agree on exactly 3 stored database statuses (`AVAILABLE`, `ON_BREAK`, `OFFLINE`). The `BUSY` / `Queue Full` status is computed dynamically at render time. |
| **Token State Machine** | `01-backend-schema.md`, `04-trd.md` (Advance rules), `GEMINI.md` | **Fully Agree** | All documents enforce the exact one-way transition order: `BOOKED → AWAITING_ARRIVAL → PAYMENT_PENDING → READY → CALLED → IN_CONSULTATION → COMPLETED`. |

---

## 5. Missing Detection

- **Topic: Cloudflare Turnstile Secrets & Payload Details**
  - **Why it matters:** Turnstile is required to prevent SMS abuse on the `/api/v1/auth/send-otp` route, but the documents do not define the environment variable name (e.g. `TURNSTILE_SECRET_KEY`) or the verification endpoint payload shape.
  - **Location to add:** `docs/02-security-access.md` Section 4 (SMS Abuse Prevention).
- **Topic: Custom Postgres Sequence Migration SOP**
  - **Why it matters:** A custom sequence `doctor_jvc_seq` and database function `generate_doctor_id()` are specified in `01-backend-schema.md`. However, Prisma migrations do not natively execute raw SQL sequences without manual SQL file adjustments in a migration folder.
  - **Location to add:** `docs/01-backend-schema.md` Step 5 or `docs/10-deployment-devops.md`.
- **Topic: Cloudinary Document Upload Parameters**
  - **Why it matters:** Doctors upload credentials and clinic photos to Cloudinary. Upload file size limits, accepted MIME types (e.g. PDF, JPG, PNG only), and signed uploads presets are not specified.
  - **Location to add:** `docs/02-security-access.md` or `docs/07-frontend-spec.md`.
- **Topic: Notification Failure Logging Details**
  - **Why it matters:** SMS and browser push notifications have silent-fail behaviors. There is no specified schema or path to log delivery failures in the audit log or database for support triage.
  - **Location to add:** `docs/02-security-access.md` or `docs/04-trd.md`.

---

## 6. Unclear/Ambiguous Detection

- **Quote:** `"Logical date — 04:00 AM IST boundary"`
  - **Location:** `docs/01-backend-schema.md` / Table 4 (daily_queues)
  - **Ambiguity:** Server runtimes (like Vercel) default to UTC. How should logical date queries map Javascript/Prisma `Date` objects? If a patient books on June 19 at 02:00 AM IST (which is June 18 20:30 UTC), it belongs to the logical queue of June 18.
  - **Question to resolve:** Should `DailyQueue.date` be mapped as a Prisma `DateTime` stored at UTC midnight of the logical date, or is a text string `YYYY-MM-DD` preferred?
- **Quote:** `"The auto-linking occurs silently in the service layer."`
  - **Location:** `docs/04-trd.md` / Section 4.0 (Walk-in Patient Auto-Linking)
  - **Ambiguity:** If a patient is booked as a walk-in, and later signs up as a user under the same phone number, are past walk-in tokens linked retroactively?
  - **Question to resolve:** Is auto-linking a one-time trigger on token booking, or is there a post-signup sync task to map historic unlinked walk-in tokens to the new user record?
- **Quote:** `"calm = trust"` and `"calm inline break message"`
  - **Location:** `docs/08-design-ui-ux.md` / Section 10 & 11
  - **Ambiguity:** Vague, subjective UI guidelines. Different developers could implement these using different colors, fonts, or component patterns.
  - **Question to resolve:** What are the exact CSS classes, components, or layout constraints for rendering the break message card?
- **Quote:** `"Simple progress bar (no time estimate — only position)"`
  - **Location:** `docs/03-search-engine.md` / Token Status Page
  - **Ambiguity:** How is the progress bar's width calculated if there is no estimated time?
  - **Question to resolve:** Is the progress bar segmented by token state (e.g. `BOOKED` -> `READY` -> `CALLED`) or continuous based on patients ahead (`currentTokenNumber / totalTokensIssued`)?

---

## 7. Truth Check (Code vs. Docs Mismatches)

- **Claim:** Stated complete Next.js 14 stack with Tailwind, Shadcn, Lucide React, jose, NextAuth, etc.
  - **Source:** `GEMINI.md` (Complete Tech Stack), `docs/04-trd.md` (Folder Structure).
  - **Mismatch:** `package.json` contains only Prisma and TypeScript dependencies. The repository contains no Next.js/React code, no frontend files, and no `src/` or `app/` folder structures.
- **Claim:** Seeding script seeds Admin or Doctor accounts.
  - **Source:** Previous agent implementation notes.
  - **Mismatch:** `prisma/seed.ts` only contains upserts for `District` and `Speciality` models. There is no code seeding an admin or doctor user.

---

## 8. Needs Human Decision

- **Logical Date Storage Standard:** Whether to enforce PostgreSQL date-only columns (`@db.Date` in Prisma) for logical queue dates instead of timezone-aware `DateTime` columns to prevent timezone conversion discrepancies.
- **Retroactive Walk-in Linking:** Whether walk-in bookings made under a phone number before patient signup should be retroactively linked to the patient `User` account upon successful signup.
- **Cloudflare Turnstile OTP Security Config:**
  - What are the designated environment variable names for the Turnstile site key and secret key (e.g., `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`)?
  - What is the exact verification API payload shape expected from the client (e.g., `{ turnstileToken: string }`)?
  - What should be the fail behavior if the Turnstile API endpoint is unreachable or times out: fail-open (allow OTP) or fail-closed (block OTP)?

---

## 9. Prioritized Action List

### A. Blocking (Must fix before implementation starts)
1. **Initialize Next.js Workspace:** Scaffold the Next.js 14 App Router workspace in the repository, installing core dependencies (`tailwindcss`, `@prisma/client`, `zod`, `lucide-react`, `next-auth`).
2. **Standardize Logical Date Time Mapping:** Define a shared date utility function (`getLogicalDate()`) that maps UTC server timestamps to logical IST boundaries.
3. **Establish custom DB Sequence Migration SOP:** Document how the raw SQL sequence and function will be executed in Prisma migrations (e.g., via a blank migration `db execute`).

### B. Nice-to-have (Can fix during implementation)
1. Document Cloudflare Turnstile verification secret environment variable names.
2. Define Cloudinary document size and format validations.
3. Detail notification failure logging schema in audit logs.

---

## 10. Post-Fix Overlap Re-check

A comprehensive re-scan of the 5 audit resolution topics was performed after remediation to verify single-source of truth compliance:

1. **Tech Stack & Build Status:**
   - The intended target architecture stack is canonical in `docs/04-trd.md` (Section 2).
   - The current implementation build status is canonical in `GEMINI.md` (Current Build Status section).
   - All duplicate present-tense configuration claims have been removed. Compliance: **100%**.

2. **Seed Data Requirements:**
   - The canonical seed data description and the launch bootstrap Admin record requirements live strictly in `docs/01-backend-schema.md` (V1 Minimum Seed Data).
   - The database seed.ts script gap has been flagged as a backlog item in Section 7 (Truth Check) of this report. Compliance: **100%**.

3. **Logical Date / IST Boundary Formula:**
   - The exact timezone formula is canonical in `docs/01-backend-schema.md` (Canonical Logical Date Timezone Rule).
   - All duplicate restatements (such as in `docs/02-security-access.md`) have been replaced with a cross-reference link. Compliance: **100%**.

4. **Postgres Custom Sequence Migration:**
   - The CI/CD deployment execution strategy and migration details for the custom sequence live canonically in `docs/10-deployment-devops.md` (Section 7).
   - `docs/01-backend-schema.md` has been updated to remove SQL code duplication and links directly to the DevOps document. Compliance: **100%**.

5. **Turnstile / OTP Anti-abuse Config:**
   - All open configuration questions (secrets, payloads, fail behavior) are deferred to the "Needs Human Decision" section of this report.
   - Once resolved, the specifications will reside canonically in `docs/02-security-access.md` only. Compliance: **100%**.
