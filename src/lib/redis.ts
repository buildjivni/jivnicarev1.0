import { Redis } from "@upstash/redis";

class MockRedis {
  private store = new Map<string, { value: any; expiry?: number }>();

  private ensureNotProduction() {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Redis operation failed: MockRedis is active in production, meaning UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing!"
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.ensureNotProduction();
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    this.ensureNotProduction();
    const expiry = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.store.set(key, { value, expiry });
    return "OK";
  }

  async del(key: string | string[]): Promise<number> {
    this.ensureNotProduction();
    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;
    for (const k of keys) {
      if (this.store.delete(k)) {
        deleted++;
      }
    }
    return deleted;
  }

  async ping(): Promise<string> {
    this.ensureNotProduction();
    return "PONG";
  }

  async ttl(key: string): Promise<number> {
    this.ensureNotProduction();
    const item = this.store.get(key);
    if (!item || (item.expiry && Date.now() > item.expiry)) {
      return -2;
    }
    if (!item.expiry) {
      return -1;
    }
    return Math.max(0, Math.ceil((item.expiry - Date.now()) / 1000));
  }

  async incr(key: string): Promise<number> {
    this.ensureNotProduction();
    const item = this.store.get(key);
    let val = 0;
    if (item) {
      val = parseInt(item.value, 10) || 0;
    }
    val++;
    this.store.set(key, { value: val });
    return val;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.ensureNotProduction();
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiry = Date.now() + seconds * 1000;
    return 1;
  }
}

const useMock = !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = useMock
  ? (new MockRedis() as unknown as Redis)
  : new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

export default redis;
