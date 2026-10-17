import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RequestHeaders = Record<string, string | string[] | undefined>;

function firstHeader(headers: RequestHeaders, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(headers: RequestHeaders) {
  const forwarded = firstHeader(headers, "x-vercel-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? Redis.fromEnv()
  : null;

const accountLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: "login:account" })
  : null;
const ipLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "15 m"), prefix: "login:ip" })
  : null;

export async function allowLoginAttempt(email: string, headers: RequestHeaders) {
  if (!accountLimiter || !ipLimiter) {
    return true;
  }
  const ip = getClientIp(headers);
  const emailKey = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const [account, address] = await Promise.all([
    accountLimiter.limit(emailKey),
    ipLimiter.limit(ip),
  ]);
  return account.success && address.success;
}
