/** 
 * Rate Limiter Configuration
 * Dual-mode: In-memory (fallback) + Upstash Redis (production)
 */

import { Redis } from '@upstash/redis';

// Upstash Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// In-memory fallback storage
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const memoryStore = new Map<string, RateLimitEntry>();

// Config
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per window

export function getClientIP(request: { headers: Headers }): string {
  // Try X-Forwarded-For first (for reverse proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    return ips[0].trim();
  }
  
  // Try CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  // Fallback
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

export async function checkRateLimit(request: { headers: Headers }): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const ip = getClientIP(request);
  const now = Date.now();
  
  // Try Upstash Redis first
  if (redis) {
    try {
      const key = `ratelimit:${ip}`;
      const data = await redis.get<RateLimitEntry>(key);
      
      let entry: RateLimitEntry;
      if (!data || data.resetTime < now) {
        entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
        await redis.set(key, entry, { ex: RATE_LIMIT_WINDOW_MS / 1000 });
      } else {
        entry = data;
        entry.count += 1;
        await redis.set(key, entry);
      }
      
      const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
      const resetTime = entry.resetTime;
      const allowed = entry.count <= RATE_LIMIT_MAX;
      
      return { allowed, remaining, resetTime };
    } catch (err) {
      console.warn('[RateLimit] Redis failed, falling back to memory:', err);
    }
  }
  
  // Fallback to in-memory
  let entry = memoryStore.get(ip);
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    memoryStore.set(ip, entry);
  } else {
    entry.count += 1;
  }
  
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetTime = entry.resetTime;
  const allowed = entry.count <= RATE_LIMIT_MAX;
  
  return { allowed, remaining, resetTime };
}
