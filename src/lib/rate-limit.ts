type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function pruneExpired(now: number) {
  if (buckets.size < 500 || Math.random() > 0.05) return;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

/** Fixed-window counter (in-memory). Fine for a single Node process; use Redis for multi-instance. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  pruneExpired(now);
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 1, resetAt: now + windowMs };
    buckets.set(key, b);
    return { ok: true };
  }
  if (b.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true };
}

export function clientKeyFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
