/**
 * In-memory fixed-window rate limiter.
 *
 * تنبيه على Cloudflare Workers / Serverless:
 * - الحالة لكل isolate (كل cold start يبدأ بـ Map فاضي).
 * - Workers يشغّل عشرات الـ isolates؛ مهاجم مصمّم يقدر يوزّع الطلبات.
 * - مناسب كخط دفاع أول ضد burst attacks ومحاولات brute-force البسيطة.
 *
 * لضمانات أقوى ضد هجمات موزّعة: استبدل بـ Cloudflare KV / Durable Objects
 * أو Supabase RPC counter.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** UNIX ms when the window resets. */
  resetAt: number;
  /** Seconds until reset, for `Retry-After` header. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

/**
 * أفضل تخمين لـ IP العميل (Cloudflare يضع `cf-connecting-ip` دائماً، بقية الـ
 * بروكسيات تستخدم `x-forwarded-for`).
 */
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Standard RateLimit headers (draft-ietf-httpapi-ratelimit-headers). */
export function rateLimitHeaders(
  result: RateLimitResult,
  limit: number,
  windowSeconds: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
    "RateLimit-Policy": `${limit};w=${windowSeconds}`,
  };
  if (!result.ok) headers["Retry-After"] = String(result.retryAfter);
  return headers;
}
