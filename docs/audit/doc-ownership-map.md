# JivniCare — Document Ownership Map
# Version: V1.0.0
# Date: June 18, 2026

This ownership map defines the single canonical source of truth for each technical topic in the JivniCare v1.0.0 documentation. Any other document referencing these topics must do so via a brief cross-reference link and must not duplicate the underlying details or formulas.

| Topic | Canonical Doc (Single Source of Truth) | Other Docs (Reference-only, no restated detail) |
| :--- | :--- | :--- |
| **Tech Stack & Build Status** | `GEMINI.md` (current implementation state) & `docs/04-trd.md` (intended target architecture design) | `docs/05-prd.md` |
| **Seed Data Requirements** | `docs/01-backend-schema.md` (V1 Minimum Seed Data) | `docs/02-security-access.md`, `docs/04-trd.md` |
| **Logical Date / IST Boundary Formula** | `docs/01-backend-schema.md` (Logical Date timezone formula) | `docs/04-trd.md` (Logical Date boundaries), `GEMINI.md` (Queue engine rules) |
| **Postgres Custom Sequence Migration Process** | `docs/10-deployment-devops.md` (Database migrations setup) | `docs/01-backend-schema.md` (Step 5 doctor ID sequence) |
| **Turnstile / OTP Anti-abuse Config** | `docs/02-security-access.md` (SMS Abuse Prevention and Turnstile checks) | `docs/04-trd.md` (API contracts for OTP endpoints) |
