import redis from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { createJWT, setSessionCookie, clearSessionCookie } from "@/lib/utils/auth";
import { encrypt, decrypt, generatePhoneHash } from "@/lib/services/crypto.service";
import { ERRORS } from "@/lib/utils/api-response";
import crypto from "crypto";

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

  // 1.5. Check resend cooldown (25s)
  if (redisHealthy) {
    const hasCooldown = await redis.get<string>(COOLDOWN_KEY(phoneHash));
    if (hasCooldown) {
      const ttl = await redis.ttl(COOLDOWN_KEY(phoneHash));
      return { success: false, message: "Please wait 25 seconds before requesting another OTP.", retryAfter: ttl > 0 ? ttl : 25 };
    }
  } else {
    // DB Fallback cooldown check
    const cooldownLog = await prisma.rateLimitLog.findFirst({
      where: {
        identifier: phoneHash,
        type: "PHONE_OTP_COOLDOWN",
      },
    });
    if (cooldownLog) {
      const elapsed = Math.floor((Date.now() - cooldownLog.windowStart.getTime()) / 1000);
      const remaining = 25 - elapsed;
      if (remaining > 0) {
        return { success: false, message: "Please wait 25 seconds before requesting another OTP.", retryAfter: remaining };
      } else {
        await prisma.rateLimitLog.delete({ where: { id: cooldownLog.id } }).catch(() => {});
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

  // 6. Increment attempt counter (for rate limiting next request) and set cooldown
  if (redisHealthy) {
    await redis.set(COOLDOWN_KEY(phoneHash), "1", { ex: 25 });
    await redis.incr(ATTEMPT_KEY(phoneHash));
    await redis.expire(ATTEMPT_KEY(phoneHash), 900);
  } else {
    // Set DB cooldown
    await prisma.rateLimitLog.upsert({
      where: {
        identifier_type: {
          identifier: phoneHash,
          type: "PHONE_OTP_COOLDOWN",
        },
      },
      update: { windowStart: new Date() },
      create: {
        identifier: phoneHash,
        type: "PHONE_OTP_COOLDOWN",
        count: 1,
        windowStart: new Date(),
      },
    });

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
export async function verifyOTP(phone: string, otp: string) {
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
  const jwt = await createJWT({ userId: user.id, role: user.role, sessionId: session.id });
  setSessionCookie(jwt);

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
    };
  }

  return { success: false, message: ERRORS.FORBIDDEN };
}

// ── LOGOUT ────────────────────────────────────────────────────
export async function logout(sessionId: string) {
  await prisma.authSession.deleteMany({ where: { id: sessionId } });
  clearSessionCookie();
}
