import { Ratelimit } from "@upstash/ratelimit";
import redis from "@/lib/redis";
import { NextRequest, NextResponse } from "next/server";

export const rateLimits = {
  otp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15m"),
    prefix: "rl:otp",
  }),
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1h"),
    prefix: "rl:login",
  }),
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1h"),
    prefix: "rl:search",
  }),
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1h"),
    prefix: "rl:admin",
  }),
};

export async function applyRateLimit(
  request: NextRequest,
  limiter: Ratelimit
): Promise<NextResponse | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Fail-open if Redis is not configured
    return null;
  }

  try {
    const ip =
      request.ip ?? request.headers.get("x-forwarded-for") ?? "anonymous";

    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }
  } catch (err) {
    console.error("Rate limiting failed, failing open:", err);
  }
  return null;
}
