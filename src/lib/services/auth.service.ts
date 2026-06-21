import redis from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { createJWT, setSessionCookie, clearSessionCookie } from "@/lib/utils/auth";
import { encrypt, decrypt, generatePhoneHash } from "@/lib/services/crypto.service";
import { ERRORS } from "@/lib/utils/api-response";
import crypto from "crypto";
import { notificationService } from "@/lib/services/notification.service";
import { createAuditLog } from "@/lib/services/audit.service";
import { NotificationType, NotificationStatus, AuditAction } from "@prisma/client";

// Fail-fast startup/build check in production if ADMIN_NOTIFICATION_EMAIL is missing
if (process.env.NODE_ENV === "production" && !process.env.ADMIN_NOTIFICATION_EMAIL) {
  throw new Error("ADMIN_NOTIFICATION_EMAIL environment variable is missing in production!");
}

const OTP_KEY = (p: string) => `otp:${p}`;
const ATTEMPT_KEY = (p: string) => `otp_att:${p}`;
const BLOCK_KEY = (p: string) => `otp_blocked:${p}`;
const COOLDOWN_KEY = (p: string) => `otp_cooldown:${p}`;

// Helper to check if Redis is working
async function isRedisHealthy(): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }
  try {
    await redis.ping();
    return true;
  } catch (err) {
    console.error("Redis ping failed, falling back to database:", err);
    return false;
  }
}

// ── GENERATE OTP ─────────────────────────────────────────────
export async function generateOTP(phone: string) {
  const phoneHash = generatePhoneHash(phone);
  const redisHealthy = await isRedisHealthy();

  // 1. Check if blocked
  if (redisHealthy) {
    const isBlocked = await redis.get<string>(BLOCK_KEY(phoneHash));
    if (isBlocked) {
      const ttl = await redis.ttl(BLOCK_KEY(phoneHash));
      return { success: false, message: ERRORS.OTP_BLOCKED, retryAfter: ttl > 0 ? ttl : 900 };
    }
  } else {
    // DB Fallback block check
    const blockLog = await prisma.rateLimitLog.findFirst({
      where: {
        identifier: phoneHash,
        type: "PHONE_OTP_BLOCK",
      },
    });
    if (blockLog) {
      const elapsed = Math.floor((Date.now() - blockLog.windowStart.getTime()) / 1000);
      const remaining = 900 - elapsed;
      if (remaining > 0) {
        return { success: false, message: ERRORS.OTP_BLOCKED, retryAfter: remaining };
      } else {
        // Block expired, clean it up
        await prisma.rateLimitLog.delete({ where: { id: blockLog.id } }).catch(() => {});
      }
    }
  }

  // 1.5. Check and Set resend cooldown (25s) atomically (lock)
  if (redisHealthy) {
    const setSuccess = await redis.set(COOLDOWN_KEY(phoneHash), "1", { nx: true, ex: 25 });
    if (!setSuccess) {
      const ttl = await redis.ttl(COOLDOWN_KEY(phoneHash));
      return { success: false, message: "Please wait 25 seconds before requesting another OTP.", retryAfter: ttl > 0 ? ttl : 25 };
    }
  } else {
    // DB Fallback cooldown check and set atomically
    try {
      await prisma.rateLimitLog.create({
        data: {
          identifier: phoneHash,
          type: "PHONE_OTP_COOLDOWN",
          count: 1,
          windowStart: new Date(),
        },
      });
    } catch (e) {
      // Cooldown log already exists, retrieve remaining time
      const cooldownLog = await prisma.rateLimitLog.findUnique({
        where: {
          identifier_type: {
            identifier: phoneHash,
            type: "PHONE_OTP_COOLDOWN",
          },
        },
      });
      if (cooldownLog) {
        const elapsed = Math.floor((Date.now() - cooldownLog.windowStart.getTime()) / 1000);
        const remaining = 25 - elapsed;
        if (remaining > 0) {
          return { success: false, message: "Please wait 25 seconds before requesting another OTP.", retryAfter: remaining };
        } else {
          // Reset cooldown if expired but not deleted
          await prisma.rateLimitLog.update({
            where: { id: cooldownLog.id },
            data: { windowStart: new Date() },
          });
        }
      }
    }
  }

  // 2. Enforce 5 requests per 15 mins rate limit
  if (redisHealthy) {
    const attempts = await redis.get<number>(ATTEMPT_KEY(phoneHash));
    if (attempts && attempts >= 5) {
      // Set block key for 15 minutes (900s)
      await redis.set(BLOCK_KEY(phoneHash), "1", { ex: 900 });
      await redis.del(ATTEMPT_KEY(phoneHash));
      return { success: false, message: ERRORS.OTP_BLOCKED, retryAfter: 900 };
    }
  } else {
    // DB Fallback attempt tracking
    const attemptLog = await prisma.rateLimitLog.findUnique({
      where: {
        identifier_type: {
          identifier: phoneHash,
          type: "PHONE_OTP",
        },
      },
    });

    if (attemptLog) {
      const age = Date.now() - attemptLog.windowStart.getTime();
      if (age < 15 * 60 * 1000) {
        if (attemptLog.count >= 5) {
          // Block phone number in DB
          await prisma.rateLimitLog.upsert({
            where: {
              identifier_type: {
                identifier: phoneHash,
                type: "PHONE_OTP_BLOCK",
              },
            },
            update: { windowStart: new Date() },
            create: {
              identifier: phoneHash,
              type: "PHONE_OTP_BLOCK",
              count: 1,
              windowStart: new Date(),
            },
          });
          // Reset attempts
          await prisma.rateLimitLog.delete({ where: { id: attemptLog.id } }).catch(() => {});
          return { success: false, message: ERRORS.OTP_BLOCKED, retryAfter: 900 };
        }
      } else {
        // Log is stale, reset it
        await prisma.rateLimitLog.delete({ where: { id: attemptLog.id } }).catch(() => {});
      }
    }
  }

  // 3. Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  // 4. Store OTP hash (expiry 300s)
  if (redisHealthy) {
    await redis.set(OTP_KEY(phoneHash), hash, { ex: 300 });
  } else {
    // DB Fallback OTP Storage: Store hash inside identifier with type "OTP_HASH"
    const fallbackId = `${phoneHash}:${hash}`;
    // Clear any previous fallback OTP for this phone number
    const oldLogs = await prisma.rateLimitLog.findMany({
      where: {
        type: "OTP_HASH",
        identifier: { startsWith: `${phoneHash}:` },
      },
    });
    for (const oldLog of oldLogs) {
      await prisma.rateLimitLog.delete({ where: { id: oldLog.id } }).catch(() => {});
    }
    // Create new OTP log
    await prisma.rateLimitLog.create({
      data: {
        identifier: fallbackId,
        type: "OTP_HASH",
        count: 1,
        windowStart: new Date(),
      },
    });
  }

  // 5. Send via 2Factor.in with 2-attempt silent-fail retry
  await sendOTP(phone, otp);

  // 6. Increment attempt counter (for rate limiting next request)
  if (redisHealthy) {
    await redis.incr(ATTEMPT_KEY(phoneHash));
    await redis.expire(ATTEMPT_KEY(phoneHash), 900);
  } else {
    await prisma.rateLimitLog.upsert({
      where: {
        identifier_type: {
          identifier: phoneHash,
          type: "PHONE_OTP",
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        identifier: phoneHash,
        type: "PHONE_OTP",
        count: 1,
        windowStart: new Date(),
      },
    });
  }

  return { success: true, message: "OTP sent" };
}

// ── VERIFY OTP ───────────────────────────────────────────────
export async function verifyOTP(phone: string, otp: string, ip?: string, isDoctorRegister?: boolean) {
  const phoneHash = generatePhoneHash(phone);
  const redisHealthy = await isRedisHealthy();
  let storedHash: string | null = null;
  let fallbackLogId: string | null = null;

  if (redisHealthy) {
    storedHash = await redis.get<string>(OTP_KEY(phoneHash));
  } else {
    // DB Fallback OTP verification
    const otpLog = await prisma.rateLimitLog.findFirst({
      where: {
        type: "OTP_HASH",
        identifier: { startsWith: `${phoneHash}:` },
      },
    });
    if (otpLog) {
      const elapsed = Date.now() - otpLog.windowStart.getTime();
      if (elapsed < 5 * 60 * 1000) {
        // Extract hash from "phoneHash:hash"
        storedHash = otpLog.identifier.split(":")[1] || null;
        fallbackLogId = otpLog.id;
      } else {
        // Expired, clean up
        await prisma.rateLimitLog.delete({ where: { id: otpLog.id } }).catch(() => {});
      }
    }
  }

  if (!storedHash) {
    return { success: false, message: ERRORS.OTP_EXPIRED };
  }

  const submittedHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (submittedHash !== storedHash) {
    return { success: false, message: ERRORS.INVALID_OTP };
  }

  // OTP verified successfully! Clean up keys.
  if (redisHealthy) {
    await redis.del(OTP_KEY(phoneHash));
    await redis.del(ATTEMPT_KEY(phoneHash));
  } else if (fallbackLogId) {
    await prisma.rateLimitLog.delete({ where: { id: fallbackLogId } }).catch(() => {});
    // Clean up attempts
    await prisma.rateLimitLog.delete({
      where: {
        identifier_type: {
          identifier: phoneHash,
          type: "PHONE_OTP",
        },
      },
    }).catch(() => {});
  }

  // Find or create User
  let user = await prisma.user.findUnique({ where: { phoneHash } });
  const isNewUser = !user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: encrypt(phone),
        phoneHash,
        role: "PATIENT",
        authProvider: "PATIENT_OTP",
      },
    });
  }

  if (user.isBanned) {
    return { success: false, message: "Account suspended." };
  }

  // Enforce session limits (max 2 for Patients)
  await enforceSessionLimit(user.id, user.role);

  // Create database session record
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Sign JWT session and set httpOnly cookie
  const jwt = await createJWT({
    userId: user.id,
    role: isDoctorRegister ? "DOCTOR_PENDING_GOOGLE_LINK" : user.role,
    sessionId: session.id,
  });
  setSessionCookie(jwt);

  // Welcome actions for new sign-ups
  if (isNewUser) {
    const clientIp = ip || "anonymous";
    await prisma.consentLog.create({
      data: {
        userId: user.id,
        consentText: "By proceeding, you agree to JivniCare's Terms of Service and Privacy Policy. You consent to receiving updates via SMS/WhatsApp.",
        consentVersion: "TERMS_V1.0",
        ipAddress: clientIp,
      },
    }).catch((err) => console.error("Failed to create consent log:", err));

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "Welcome to JivniCare",
        message: "Thank you for signing up with JivniCare. You can now book doctor checkup tokens online.",
        type: NotificationType.SYSTEM,
        status: NotificationStatus.SENT,
      },
    }).catch((err) => console.error("Failed to create welcome notification:", err));

    createAuditLog({
      userId: user.id,
      role: user.role,
      action: AuditAction.CREATE,
      entityType: "USER",
      entityId: user.id,
      ipAddress: clientIp,
      newValue: { phoneHash },
    });
  }

  return { success: true, user };
}

// ── SESSION LIMIT ─────────────────────────────────────────────
export async function enforceSessionLimit(userId: string, role: string) {
  const limits: Record<string, number> = { PATIENT: 2, DOCTOR: 3, ADMIN: 1 };
  const limit = limits[role] ?? 2;

  const sessions = await prisma.authSession.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  });

  if (sessions.length >= limit) {
    const toRevoke = sessions.slice(0, sessions.length - limit + 1);
    await prisma.authSession.deleteMany({
      where: { id: { in: toRevoke.map((s) => s.id) } },
    });
  }
}

// ── 2FACTOR.IN OTP SENDER ─────────────────────────────────────
async function sendOTP(phone: string, otp: string) {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  if (!apiKey) {
    console.warn(`[SMS Mock] OTP for ${phone} is: ${otp} (TWOFACTOR_API_KEY missing)`);
    return;
  }

  const send = async () => {
    const res = await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/OTP1`,
      { method: "GET" }
    );
    if (!res.ok) {
      throw new Error(`SMS gateway error: ${res.statusText}`);
    }
  };

  // Try twice, silent fail
  try {
    await send();
  } catch (err) {
    console.error(`SMS send attempt 1 failed:`, err);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await send();
    } catch (err2) {
      console.error(`SMS send attempt 2 failed (silent fail):`, err2);
    }
  }
}

// ── GOOGLE OAUTH LOGIN ────────────────────────────────────────
export async function loginGoogleUser(email: string, googleId: string, name: string) {
  // 1. Check if Admin
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) {
    // Admin login flow
    if (!admin.googleId) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { googleId },
      });
    }

    // Ensure User table record exists for JWT/Session linkage
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          role: "ADMIN",
          googleId,
          phone: "", // No phone needed for admin
          phoneHash: null,
          authProvider: "GOOGLE_OAUTH",
        },
      });
    }

    // Since Admin requires TOTP, return status showing TOTP is required.
    // We sign a temporary JWT session with role: "ADMIN_PENDING_MFA"
    const tempSession = await prisma.authSession.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      },
    });

    const jwt = await createJWT({
      userId: user.id,
      role: "ADMIN_PENDING_MFA",
      sessionId: tempSession.id,
    });
    setSessionCookie(jwt);

    return {
      success: true,
      role: "ADMIN",
      mfaRequired: true,
      totpEnabled: admin.totpEnabled,
    };
  }

  // 2. Check if Doctor
  const doctor = await prisma.doctor.findFirst({
    where: {
      email,
    },
  });

  if (doctor) {
    // Ensure User table record exists
    let user = await prisma.user.findUnique({ where: { id: doctor.userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: doctor.userId,
          email,
          name: doctor.name,
          role: "DOCTOR",
          googleId,
          phone: encrypt(doctor.phone),
          phoneHash: generatePhoneHash(doctor.phone),
          authProvider: "GOOGLE_OAUTH",
        },
      });
    } else {
      // Keep googleId synced
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId, authProvider: "GOOGLE_OAUTH" },
        });
      }
    }

    if (user.isBanned) {
      return { success: false, message: "Doctor account suspended." };
    }

    // Enforce session limit
    await enforceSessionLimit(user.id, user.role);

    // Create session
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set cookie
    const jwt = await createJWT({ userId: user.id, role: user.role, sessionId: session.id });
    setSessionCookie(jwt);

    return {
      success: true,
      role: "DOCTOR",
      mfaRequired: false,
      registrationComplete: doctor.registrationComplete,
      verificationStatus: doctor.verificationStatus,
    };
  }

  return { success: false, message: ERRORS.FORBIDDEN };
}

// ── LOGOUT ────────────────────────────────────────────────────
export async function logout(sessionId: string) {
  await prisma.authSession.deleteMany({ where: { id: sessionId } });
  clearSessionCookie();
}

/**
 * Retrieves the User record by ID, verifying bans and active state, and decrypts their phone
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isBanned: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error("NOT_FOUND");
  }

  if (user.isBanned || !user.isActive) {
    throw new Error("SUSPENDED");
  }

  const decryptedPhone = user.phone ? decrypt(user.phone) : "";

  return {
    ...user,
    phone: decryptedPhone,
  };
}

/**
 * Moves IP-level rate-limiting validation from routes to service layer
 */
export async function verifyIpRateLimit(ip: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const ipLog = await prisma.rateLimitLog.findUnique({
    where: {
      identifier_type: {
        identifier: ip,
        type: "IP_OTP",
      },
    },
  });

  if (ipLog) {
    if (ipLog.windowStart > oneHourAgo) {
      if (ipLog.count >= 10) {
        return false;
      }
      await prisma.rateLimitLog.update({
        where: { id: ipLog.id },
        data: { count: { increment: 1 } },
      });
    } else {
      await prisma.rateLimitLog.update({
        where: { id: ipLog.id },
        data: { count: 1, windowStart: new Date() },
      });
    }
  } else {
    await prisma.rateLimitLog.create({
      data: {
        identifier: ip,
        type: "IP_OTP",
        count: 1,
        windowStart: new Date(),
      },
    });
  }
  return true;
}

// ── UPDATE USER PROFILE ───────────────────────────────────────
// NOTE: The email field is used only for notifications and uniqueness-checking.
// Patient login remains strictly phone-OTP only via the jvc_session flow; the email field has no login/auth role.
export async function updateUserProfile(
  userId: string,
  data: { name?: string; email?: string | null }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found.");
  }
  if (user.isBanned || !user.isActive) {
    throw new Error("PATIENT_SUSPENDED");
  }

  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        id: { not: userId },
      },
    });
    if (existing) {
      throw new Error("EMAIL_IN_USE");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  createAuditLog({
    userId,
    action: AuditAction.UPDATE,
    entityType: "USER",
    entityId: userId,
    newValue: data,
  });

  const decryptedPhone = updated.phone ? decrypt(updated.phone) : "";

  return {
    ...updated,
    phone: decryptedPhone,
  };
}

// ── REQUEST DATA DELETION ─────────────────────────────────────
export async function requestUserDataDeletion(userId: string, clientIp: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("NOT_FOUND");
  }

  if (user.isBanned || !user.isActive) {
    throw new Error("USER_SUSPENDED");
  }

  const decryptedPhone = user.phone ? decrypt(user.phone) : "Unknown Phone";

  // 1. Create audit log of deletion request
  createAuditLog({
    userId,
    action: AuditAction.DELETE,
    entityType: "USER",
    entityId: userId,
    ipAddress: clientIp,
  });

  // 2. Send email notification to admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_NOTIFICATION_EMAIL environment variable is not configured!");
  }
  const emailSubject = `[JivniCare] User Data Deletion Request - ${userId}`;
  const emailContent = `
    <h2>Data Deletion Request</h2>
    <p>A patient has requested the deletion of their JivniCare account and all associated data.</p>
    <ul>
      <li><strong>User ID:</strong> ${userId}</li>
      <li><strong>Phone:</strong> ${decryptedPhone}</li>
      <li><strong>Email:</strong> ${user.email || "N/A"}</li>
      <li><strong>Request IP:</strong> ${clientIp}</li>
      <li><strong>Date:</strong> ${new Date().toISOString()}</li>
    </ul>
    <p>Under platform policy, this request must be processed and completed within 30 days.</p>
  `;

  await notificationService.sendEmail(adminEmail, emailSubject, emailContent);

  return {
    success: true,
    message: "Deletion request received. 30 days processing.",
  };
}

// ── LINK GOOGLE ACCOUNT ───────────────────────────────────────
export async function linkGoogleAccount(userId: string, email: string, googleId: string) {
  // Check if this Google account is already linked to another user
  const existingGoogle = await prisma.user.findFirst({
    where: {
      googleId,
      id: { not: userId },
    },
  });
  if (existingGoogle) {
    throw new Error("GOOGLE_ACCOUNT_ALREADY_LINKED");
  }

  const existingEmail = await prisma.user.findFirst({
    where: {
      email,
      id: { not: userId },
    },
  });
  if (existingEmail) {
    throw new Error("GOOGLE_EMAIL_ALREADY_IN_USE");
  }

  // Update the user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      googleId,
      email,
      authProvider: "GOOGLE_OAUTH",
    },
  });

  // Check if a doctor record exists for this user, and update its email too
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });
  if (doctor) {
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { email },
    });
  }

  // Create audit log
  createAuditLog({
    userId,
    role: updatedUser.role,
    action: AuditAction.UPDATE,
    entityType: "USER",
    entityId: userId,
    newValue: { googleId, email, authProvider: "GOOGLE_OAUTH" },
  });

  // Re-sign JWT session to promote them from DOCTOR_PENDING_GOOGLE_LINK to PATIENT role
  const activeSession = await prisma.authSession.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (activeSession) {
    const promotedJwt = await createJWT({
      userId,
      role: updatedUser.role, // normally PATIENT
      sessionId: activeSession.id,
    });
    setSessionCookie(promotedJwt);
  }

  return updatedUser;
}
