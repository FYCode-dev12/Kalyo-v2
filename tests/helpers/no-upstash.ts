// lib/rate-limit.ts picks Upstash at import time when these are set. Clearing
// them first forces the in-memory fallback, so tests never touch the network.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

export {};
