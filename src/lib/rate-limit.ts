/**
 * Tiny in-memory sliding-window rate limiter.
 * Good enough for a demo on one server; swap for Upstash Redis in production.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 15, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}
