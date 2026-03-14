import { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function now() {
  return Date.now();
}

/**
 * Simple in-memory fixed-window limiter (best effort).
 * Works well for single-instance deployments; use Redis/KV for distributed setups.
 */
export function checkRateLimit(
  req: NextRequest,
  action: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number; remaining: number } {
  const key = `${action}:${getClientKey(req)}`;
  const current = buckets.get(key);
  const ts = now();

  if (!current || ts >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: ts + windowMs });
    return {
      ok: true,
      retryAfterSec: Math.ceil(windowMs / 1000),
      remaining: maxRequests - 1,
    };
  }

  if (current.count >= maxRequests) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - ts) / 1000)),
      remaining: 0,
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    ok: true,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - ts) / 1000)),
    remaining: maxRequests - current.count,
  };
}
