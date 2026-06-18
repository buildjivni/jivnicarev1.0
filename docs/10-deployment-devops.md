# JivniCare V1.0.0 — Deployment & DevOps Specification
# Document: 10-deployment-devops.md
# Version: V1.0.0 FINAL

---

## 1. HOSTING & INFRASTRUCTURE

```
Platform Architecture:
  Frontend & API:     Vercel (Serverless Functions)
  Database:           Neon Postgres (Serverless Postgres)
  Caching & KV:       Upstash Redis
```

### 1.1 Region Pinning
- **Primary Region:** AWS `ap-south-1` (Mumbai).
- All serverless database instances (Neon) and caching clusters (Upstash) must be pinned to the Mumbai region to guarantee:
  1. Low latency for the primary user base in Bihar and Jharkhand.
  2. Data localization compliance as a best-practice posture under the DPDP Act 2023.

### 1.2 Connection Pooling
- Neon's built-in PgBouncer-based connection pooling must be enabled.
- Connection string in production environment variables must use the pooled URL (`-pooler` suffix) to prevent serverless execution spikes from exhausting database connection limits.

---

## 2. ENVIRONMENTS

```
Development:
  - Local workstation environment
  - Configured via local .env file (gitignored)
  - Uses local or private staging DB instance

Staging / Preview:
  - Automatic Vercel Preview Deployments triggered per git branch / Pull Request
  - Connected to a staging Neon database branch
  - Used for integration testing before merging to main

Production:
  - Live customer-facing environment
  - Automatic deployments triggered only on push/merge to `main` branch
  - Connected to production Neon database branch
```

---

## 3. BACKUP & DISASTER RECOVERY (DR)

- **Database Backups:** Neon automated daily snapshots enabled.
- **Point-in-Time Recovery (PITR):** Enabled on the production Neon branch for granular database restoration.
- **RPO (Recovery Point Objective):** ≤ 24 hours (maximum data loss window in a disaster scenario).
- **RTO (Recovery Time Objective):** 2–4 hours (restoration time for service availability).
- **Manual Backups:** Required before running any database migrations in production.

---

## 4. SECRETS MANAGEMENT

- No secrets, credentials, API keys, or database URLs may be committed to code or git repositories.
- All secrets are injected dynamically at runtime via Vercel's encrypted Environment Variables console.
- Prohibited from Git tracking: `.env`, `.env.local`, `.env.production`.
- Pre-commit hooks or Git actions must validate that no environment file is staged.

---

## 5. CI/CD PIPELINE

```
GitHub Push / PR
       ↓
TypeScript Type Check (npm run type-check)
       ↓
ESLint Linter (npm run lint)
       ↓
Production Build Check (npm run build)
       ↓
Automatic Deploy to Vercel (Preview / Production)
```
- Any failure in type checking, linting, or building must immediately halt the pipeline and block deployment.

---

## 6. MONITORING & ALERTING

- **Sentry Integration:** Integrated at the client and server levels. All runtime exceptions and API errors are reported to Sentry with alerts configured for production environment alerts.
- **Uptime Monitoring:** External polling service checks the `/api/health` health-check endpoint every 5 minutes.
- **Health Check Endpoint:** `/api/health` queries both Neon database responsiveness and Upstash Redis connectivity before returning a `200 OK`.

---

## 7. DATABASE MIGRATION STRATEGY FOR CUSTOM SQL SEQUENCE

Since Prisma's declarative migration engine (`prisma migrate dev`) does not natively generate migrations for custom database sequences or functions (like the `doctor_jvc_seq` sequence and `generate_doctor_id()` helper function defined in the backend schema), the deploy pipeline must use a custom execution strategy:
1. **Script Generation:** The raw SQL definitions for sequences and functions must be stored in a dedicated SQL migration file:
   ```sql
   -- prisma/migrations/00_custom_sequence.sql
   CREATE SEQUENCE IF NOT EXISTS doctor_jvc_seq START 1;
   
   CREATE OR REPLACE FUNCTION generate_doctor_id()
   RETURNS TEXT AS $$
   BEGIN
     RETURN 'JVC' || LPAD(nextval('doctor_jvc_seq')::TEXT, 3, '0');
   END;
   $$ LANGUAGE plpgsql;
   ```
2. **CI/CD Deploy Pipeline:** The deployment script must execute this raw SQL file *before* executing standard Prisma migrations to prevent schema mismatches:
   ```bash
   # 1. Execute custom raw SQL sequence definitions
   npx prisma db execute --file ./prisma/migrations/00_custom_sequence.sql --schema ./prisma/schema.prisma
   
   # 2. Run standard Prisma migrations
   npx prisma migrate deploy
   ```

---

## 8. ROLLBACK PROCESS

- **Vercel Promotion:** In the event of a critical production bug, the immediate remediation step is to promote the last known stable Vercel deployment to production via the Vercel console.
- **Database Rollback:** If the rollback involves database schema changes, the database state must be restored using Neon's Point-in-Time Recovery branch-restore feature to the timestamp immediately preceding the deployment.

---

Document complete. Everything in this file is V1 scope.
Last updated: June 2026 | JivniCare V1.0.0

