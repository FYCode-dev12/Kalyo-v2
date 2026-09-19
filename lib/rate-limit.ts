/** Distributed rate limiting with a bounded in-memory fallback. */
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}
interface RateLimitEntry { count: number; resetTime: number }
const memoryStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

export function getClientIP(request: { headers: Headers }): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
}

export async function checkRateLimit(request: { headers: Headers }, scope: string, limit: number): Promise<RateLimitResult> {
  const key = `ratelimit:${scope}:${getClientIP(request)}`;
  const now = Date.now();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
      const resetTime = now + WINDOW_MS;
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetTime };
    } catch (error) {
      console.warn('[RateLimit] Redis unavailable, using bounded memory fallback', error);
    }
  }
  if (memoryStore.size > MAX_ENTRIES) {
    for (const [entryKey, entry] of memoryStore) if (entry.resetTime < now) memoryStore.delete(entryKey);
  }
  const current = memoryStore.get(key);
  const entry = !current || current.resetTime <= now ? { count: 1, resetTime: now + WINDOW_MS } : { count: current.count + 1, resetTime: current.resetTime };
  memoryStore.set(key, entry);
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetTime: entry.resetTime };
}

export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) return null;
  return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000))) },
  });
}
