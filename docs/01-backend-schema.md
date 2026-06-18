# JivniCare V1.0.0 — Backend Schema Specification
# Document: 01-backend-schema.md
# Version: V1.0.0 FINAL
# For:  Antigravity

---

## ⚠ STRICT RULES — READ BEFORE EXECUTING

1. DO NOT implement anything not in this document
2. DO NOT add extra fields — only what is specified here
3. DO NOT use MongoDB — PostgreSQL ONLY
4. DO NOT skip any table — all are mandatory
5. DO NOT change field names — use exact names given
6. DO NOT add payment gateway fields — display-only system
7. DO NOT add WebSocket, telemedicine, ratings, EMR tables
8. ALL enums defined in Prisma — not as plain strings
9. Run `prisma migrate dev` after every schema change
10. ASK NOTHING — execute exactly as written

---

## TECH STACK

ORM:           Prisma 5.x
Database:      PostgreSQL (Neon.tech)
Schema file:   prisma/schema.prisma
Migrations:    prisma/migrations/
Seed file:     prisma/seed.ts
Cache:         Upstash Redis (not in schema — separate client)

---

## STEP 1 — Project Init

```bash
npx prisma init
```

Set in .env:
```
DATABASE_URL="postgresql://user:password@host/jivnicare?schema=public"
```

---

## STEP 2 — Prisma Generator + Datasource

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## STEP 3 — All Enums

```prisma
enum Role {
  PATIENT
  DOCTOR
  ADMIN
}

enum AuthProvider {
  PATIENT_OTP
  GOOGLE_OAUTH
}

enum UserStatus {
  ACTIVE
  PENDING_SETUP
}

enum VerificationStatus {
  PENDING_ACTIVATION
  PENDING_REVIEW
  VERIFIED
  REJECTED
  SUSPENDED
}

enum DoctorStatus {
  AVAILABLE
  BREAK
  BUSY
  OFFLINE
}

enum QueueStatus {
  ACTIVE
  PAUSED
  CLOSED
  EXPIRED
}

enum TokenStatus {
  BOOKED
  AWAITING_ARRIVAL
  PAYMENT_PENDING
  READY
  CALLED
  IN_CONSULTATION
  COMPLETED
  NO_SHOW
  CANCELLED
  EXPIRED
}

enum TokenType {
  ONLINE
  WALKIN
}

enum QueueType {
  REGULAR
  EMERGENCY
}

enum NotificationType {
  BOOKING_CONFIRMED
  TOKEN_CALLED
  QUEUE_UPDATE
  DOCTOR_STATUS_CHANGE
  VERIFICATION_STATUS
  SYSTEM
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  VERIFY
  REJECT
  BAN
  UNBAN
  BOOK
  CANCEL
  ADVANCE
  COMPLETE
  NO_SHOW
  STATUS_CHANGE
  EMERGENCY_ENABLE
  EMERGENCY_DISABLE
}

enum PartnerTier {
  EARLY_PARTNER
  STANDARD
  PREMIUM
}

enum Gender {
  MALE
  FEMALE
  OTHER
}
```

---

## STEP 4 — All Tables

### Table 1: users
```prisma
model User {
  id            String       @id @default(uuid())
  phone         String       @unique
  name          String?
  email         String?      @unique
  role          Role         @default(PATIENT)
  googleId      String?      @unique
  authProvider  AuthProvider @default(PATIENT_OTP)
  status        UserStatus   @default(ACTIVE)
  isActive      Boolean      @default(true)
  isBanned      Boolean      @default(false)
  bannedAt      DateTime?
  bannedReason  String?
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      AuthSession[]
  doctor        Doctor?
  tokens        QueueToken[]
  notifications Notification[]
  auditLogs     AuditLog[]
  waitlists     Waitlist[]

  @@index([phone])
  @@index([role])
  @@index([isActive])
  @@map("users")
}
```

### Table 2: auth_sessions
```prisma
model AuthSession {
  id          String   @id @default(uuid())
  userId      String
  token       String   @unique
  deviceInfo  String?
  ipAddress   String?
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("auth_sessions")
}
```

### Table 3: doctors
```prisma
model Doctor {
  id                      String             @id @default(uuid())
  userId                  String             @unique
  internalDoctorId        String             @unique  // JVC001 format
  slug                    String             @unique  // dr-name-speciality-city

  // Personal Info
  name                    String
  phone                   String
  email                   String?
  gender                  Gender?
  profilePhoto            String?            // Cloudinary URL
  bio                     String?
  languages               String[]           @default(["Hindi"])

  // Professional Info
  speciality              String
  qualifications          String[]           @default([])
  experienceYears         Int                @default(0)
  registrationNumber      String
  expertiseTags           String[]           @default([])
  diseases                String[]           @default([])   // ["Diabetes","BP","Thyroid"]
  procedures              String[]           @default([])   // ["ECG","X-Ray","Ultrasound"]

  // Clinic Info
  clinicName              String
  clinicAddress           String
  clinicCity              String
  clinicDistrict          String             // "Jamui" or "Deoghar" ONLY
  clinicPhotos            String[]           @default([])   // Max 3 Cloudinary URLs
  clinicPincode           String?
  clinicLatitude          Float?
  clinicLongitude         Float?

  // Owner Info
  operatorName            String
  operatorMobile          String

  // Receptionist Info — Max 3
  receptionist1Name       String?
  receptionist1Phone      String?
  receptionist2Name       String?
  receptionist2Phone      String?
  receptionist3Name       String?
  receptionist3Phone      String?

  // Verification
  verificationStatus      VerificationStatus @default(PENDING_ACTIVATION)
  verifiedAt              DateTime?
  verifiedBy              String?
  rejectionReason         String?
  documents               String[]           @default([])   // Max 10 Cloudinary URLs

  // Emergency
  isEmergencyEnabled      Boolean            @default(false)
  emergencyCapacity       Int                @default(0)
  emergencyApprovedAt     DateTime?
  emergencyApprovedBy     String?
  emergencyPendingRequest Boolean            @default(false)  // re-verification pending

  // Schedule
  // Format: [{ day: "MON", startTime: "09:00", endTime: "14:00" }]
  weeklySchedule          Json?
  bookingWindowStart      String?            // "08:00" — when booking opens
  bookingWindowEnd        String?            // "13:00" — when booking closes

  // Queue Settings
  dailyTokenLimit         Int                @default(30)
  consultationFee         Int                @default(0)
  currentStatus           DoctorStatus       @default(OFFLINE)
  isAcceptingBookings     Boolean            @default(false)
  breakMessage            String?            // "Back in 30 minutes"
  canShowOnPublic         Boolean            @default(false)

  // Stats
  lifetimePatientsServed  Int                @default(0)
  jivnicarePatientsServed Int                @default(0)

  // Platform
  partnerTier             PartnerTier        @default(STANDARD)

  // Registration Progress
  registrationStep        Int                @default(1)    // 1,2,3,4
  registrationComplete    Boolean            @default(false)

  // Timestamps
  deletedAt               DateTime?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  user                    User               @relation(fields: [userId], references: [id])
  queues                  DailyQueue[]
  platformPricing         PlatformPricing?
  waitlists               Waitlist[]

  @@index([slug])
  @@index([speciality])
  @@index([clinicDistrict])
  @@index([clinicCity])
  @@index([verificationStatus])
  @@index([currentStatus])
  @@index([canShowOnPublic])
  @@index([partnerTier])
  @@map("doctors")
}
```

### Table 4: daily_queues
```prisma
model DailyQueue {
  id             String      @id @default(uuid())
  doctorId       String
  date           DateTime    // Logical date — 04:00 AM IST boundary
  status         QueueStatus @default(ACTIVE)
  type           QueueType   @default(REGULAR)
  currentToken   Int         @default(0)
  totalTokens    Int         @default(0)
  dailyLimit     Int
  emergencySlots Int         @default(0)
  openedAt       DateTime?
  closedAt       DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  doctor         Doctor      @relation(fields: [doctorId], references: [id])
  tokens         QueueToken[]

  @@unique([doctorId, date, type])  // One regular + one emergency queue per doctor per day
  @@index([doctorId])
  @@index([date])
  @@index([type])
  @@map("daily_queues")
}
```

### Table 5: queue_tokens
```prisma
model QueueToken {
  id                String      @id @default(uuid())
  queueId           String
  patientId         String?     // NULL for anonymous walk-in
  tokenNumber       Int         // NEVER changes after creation
  status            TokenStatus @default(BOOKED)
  type              TokenType   @default(ONLINE)

  // Walk-in patient info
  walkinName        String?
  walkinPhone       String?
  walkinAddress     String?

  // Payment
  paymentVerified   Boolean     @default(false)
  paymentVerifiedAt DateTime?
  verifiedBy        String?     // Receptionist/Doctor ID

  // Internal notes — NEVER shown to patient
  internalNotes     String?

  // Timestamps
  bookedAt          DateTime    @default(now())
  calledAt          DateTime?
  completedAt       DateTime?
  cancelledAt       DateTime?
  expiresAt         DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  queue             DailyQueue  @relation(fields: [queueId], references: [id])
  patient           User?       @relation(fields: [patientId], references: [id])

  @@index([queueId])
  @@index([patientId])
  @@index([status])
  @@index([tokenNumber])
  @@map("queue_tokens")
}
```

### Table 6: platform_pricing
```prisma
model PlatformPricing {
  id              String      @id @default(uuid())
  doctorId        String      @unique
  monthlyFee      Float       @default(2999)
  perBookingFee   Float       @default(29)
  discountPercent Int         @default(100)
  partnerTier     PartnerTier @default(EARLY_PARTNER)
  freeUntil       DateTime?
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  doctor          Doctor      @relation(fields: [doctorId], references: [id])

  @@map("platform_pricing")
}
```

### Table 7: notifications
```prisma
model Notification {
  id        String             @id @default(uuid())
  userId    String
  title     String
  message   String
  type      NotificationType
  status    NotificationStatus @default(PENDING)
  readAt    DateTime?
  createdAt DateTime           @default(now())

  user      User               @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("notifications")
}
```

### Table 8: audit_logs
```prisma
model AuditLog {
  id          String      @id @default(uuid())
  userId      String?
  role        Role?
  action      AuditAction
  entityType  String
  entityId    String?
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  createdAt   DateTime    @default(now())

  user        User?       @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([action])
  @@index([entityType])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### Table 9: archived_records
```prisma
model ArchivedRecord {
  id           String   @id @default(uuid())
  entityType   String   // "User", "Doctor", "QueueToken"
  entityId     String
  data         Json
  archivedBy   String?
  archivedAt   DateTime @default(now())
  reason       String?

  @@index([entityType])
  @@index([entityId])
  @@map("archived_records")
}
```

### Table 10: waitlists
```prisma
model Waitlist {
  id          String   @id @default(uuid())
  doctorId    String
  userId      String?  // NULL if anonymous
  phone       String
  name        String?
  notified    Boolean  @default(false)
  notifiedAt  DateTime?
  createdAt   DateTime @default(now())

  doctor      Doctor   @relation(fields: [doctorId], references: [id])
  user        User?    @relation(fields: [userId], references: [id])

  @@index([doctorId])
  @@index([phone])
  @@map("waitlists")
}
```

### Table 11: doctor_requests (lead capture)
```prisma
model DoctorRequest {
  id          String   @id @default(uuid())
  name        String
  phone       String
  district    String
  speciality  String
  contacted   Boolean  @default(false)
  contactedAt DateTime?
  notes       String?
  createdAt   DateTime @default(now())

  @@index([district])
  @@index([speciality])
  @@index([contacted])
  @@map("doctor_requests")
}
```

### Table 12: search_logs (anonymous analytics)
```prisma
model SearchLog {
  id          String   @id @default(uuid())
  query       String
  district    String?
  resultCount Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([query])
  @@index([district])
  @@index([createdAt])
  @@map("search_logs")
}
```

### Table 13: districts (seed data)
```prisma
model District {
  id        String   @id @default(uuid())
  name      String   @unique
  state     String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@map("districts")
}
```

### Table 14: specialities (seed data)
```prisma
model Speciality {
  id        String   @id @default(uuid())
  name      String   @unique
  icon      String?
  tier      Int      @default(1)
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@map("specialities")
}
```

---

## STEP 5 — PostgreSQL Sequence for JVC001

Run after first migration:
```sql
CREATE SEQUENCE doctor_jvc_seq START 1;

CREATE OR REPLACE FUNCTION generate_doctor_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'JVC' || LPAD(nextval('doctor_jvc_seq')::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

Usage in application (NOT DB trigger):
```typescript
const result = await prisma.$queryRaw<[{id: string}]>`
  SELECT generate_doctor_id() as id
`
const internalDoctorId = result[0].id
```

---

## STEP 6 — Seed Data

```typescript
// prisma/seed.ts

const districts = [
  { name: 'Jamui',   state: 'Bihar'       },
  { name: 'Deoghar', state: 'Jharkhand'   },
]

const specialities = [
  // TIER 1 — Most Common
  { name: 'General Physician',   icon: '🩺', tier: 1, sortOrder: 1  },
  { name: 'Pediatrician',        icon: '👶', tier: 1, sortOrder: 2  },
  { name: 'Gynecologist',        icon: '🤱', tier: 1, sortOrder: 3  },
  { name: 'Orthopedic',          icon: '🦴', tier: 1, sortOrder: 4  },
  { name: 'Dentist',             icon: '🦷', tier: 1, sortOrder: 5  },
  // TIER 2 — Regular
  { name: 'Dermatologist',       icon: '🔬', tier: 2, sortOrder: 6  },
  { name: 'ENT Specialist',      icon: '👂', tier: 2, sortOrder: 7  },
  { name: 'Ophthalmologist',     icon: '👁️', tier: 2, sortOrder: 8  },
  { name: 'General Surgeon',     icon: '🏥', tier: 2, sortOrder: 9  },
  { name: 'Diabetologist',       icon: '💉', tier: 2, sortOrder: 10 },
  // TIER 3 — Specialist
  { name: 'Cardiologist',        icon: '❤️', tier: 3, sortOrder: 11 },
  { name: 'Neurologist',         icon: '🧠', tier: 3, sortOrder: 12 },
  { name: 'Gastroenterologist',  icon: '🫁', tier: 3, sortOrder: 13 },
  { name: 'Pulmonologist',       icon: '🫀', tier: 3, sortOrder: 14 },
  { name: 'Endocrinologist',     icon: '⚗️', tier: 3, sortOrder: 15 },
  { name: 'Urologist',           icon: '🧬', tier: 3, sortOrder: 16 },
  { name: 'Nephrologist',        icon: '💊', tier: 3, sortOrder: 17 },
  { name: 'Psychiatrist',        icon: '💭', tier: 3, sortOrder: 18 },
  { name: 'Physiotherapist',     icon: '🏃', tier: 3, sortOrder: 19 },
  { name: 'Radiologist',         icon: '📡', tier: 3, sortOrder: 20 },
]
```

---

## STEP 7 — Run Migration + Seed

```bash
npx prisma migrate dev --name "initial_schema"
npx prisma db seed
npx prisma studio   # Verify all 14 tables created correctly
```

---

## STATE MACHINE — Token Status (ONE-WAY ONLY)

```
BOOKED → AWAITING_ARRIVAL → PAYMENT_PENDING → READY → CALLED → IN_CONSULTATION → COMPLETED
                                                     ↓              ↓
                                                  NO_SHOW        NO_SHOW

Cancellable states: BOOKED, AWAITING_ARRIVAL, PAYMENT_PENDING, READY
Auto-expire states: BOOKED, AWAITING_ARRIVAL (04:00 AM IST cron)
RULE: No reverse transitions. Ever. No exceptions.
```

---

## QUEUE RULES

```
Regular Queue:   tokenNumber = 1, 2, 3...
Emergency Queue: tokenNumber = E1, E2, E3... (separate DailyQueue with type=EMERGENCY)
Walk-in tokens:  Same sequence as regular, type=WALKIN flag
Doctor isolation: Each queue tied to doctorId + date + type (unique constraint)
Atomic booking:  Prisma $transaction with SELECT FOR UPDATE — no duplicate numbers
Max bookings:    3 active tokens per patient per day (enforced in service layer)
```

---

## VALIDATION RULES (Application layer — NOT DB)

```
clinicDistrict     → must be "Jamui" or "Deoghar" only
clinicPhotos       → max 3 items
documents          → max 10 items
receptionists      → max 3 (fields 1, 2, 3)
dailyTokenLimit    → min 1, max 100
tokenNumber        → NEVER update after creation
Patient sessions   → max 2 concurrent
Doctor sessions    → max 3 concurrent
Admin sessions     → max 1 concurrent
OTP attempts       → max 5 per 15 minutes
Active bookings    → max 3 per patient per day
Doctors per clinic → max 5 (admin enforced)
```

---

## SECURITY — Database Level

```
RULE 1: All queries via Prisma ORM — never raw SQL except JVC sequence
RULE 2: Input sanitization before every DB write (Zod schemas)
RULE 3: No sensitive data in select * queries — always specify fields
RULE 4: Soft delete only — never hard delete (use deletedAt + archive)
RULE 5: All financial data in audit_logs — immutable record
RULE 6: search_logs auto-delete after 90 days (Vercel cron)
```

---

## WHAT NOT TO BUILD

```
❌ MongoDB connection
❌ Payment gateway tables (Razorpay, Stripe, PhonePe)
❌ Telemedicine / video call tables
❌ Rating / review tables
❌ Prescription / EMR tables
❌ Insurance tables
❌ Agent role table
❌ Multi-clinic separate table
❌ Separate clinic table (clinic fields in doctors table)
```

---

## TOOL ASSIGNMENT

Cursor:      Execute all steps, write schema, run migrations, write seed.ts
Antigravity: After migration — scaffold all empty service files:
             auth.service.ts, queue.service.ts, booking.service.ts,
             search.service.ts, doctor.service.ts, admin.service.ts,
             audit.service.ts, notification.service.ts
Gemini CLI:  After scaffold — read this file + verify:
             "Does the schema match 01-backend-schema.md exactly?
              Are all 14 tables present? Any missing fields?"

---

Document complete. Execute steps 1-7 in sequence. Do not skip.
Last updated: June 2026 | JivniCare V1.0.0


