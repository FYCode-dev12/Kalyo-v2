import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Must run before lib/rate-limit is loaded.
import './helpers/no-upstash';
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

function requestFrom(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe('getClientIP', () => {
  it('uses the left-most x-forwarded-for hop', () => {
    assert.equal(getClientIP(requestFrom({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1, 10.0.0.2' })), '203.0.113.7');
  });

  it('ignores spoofable x-real-ip and cf-connecting-ip headers', () => {
    const ip = getClientIP(requestFrom({ 'x-real-ip': '198.51.100.1', 'cf-connecting-ip': '198.51.100.2' }));
    assert.equal(ip, '127.0.0.1');
  });

  it('falls back to 127.0.0.1 when the first hop is empty', () => {
    assert.equal(getClientIP(requestFrom({ 'x-forwarded-for': ' , 10.0.0.1' })), '127.0.0.1');
  });
});

describe('checkRateLimit (in-memory fallback)', () => {
  const NOW = new Date('2026-11-01T00:00:00.000Z');

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: NOW });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('allows up to the limit within a minute, then blocks', async () => {
    const req = requestFrom({ 'x-forwarded-for': '203.0.113.10' });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(req, 'login', 3));

    assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
    assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0, 0]);
    assert.ok(results.every((r) => r.resetTime === NOW.getTime() + 60_000));
  });

  it('keeps separate budgets per scope and per client IP', async () => {
    const a = requestFrom({ 'x-forwarded-for': '203.0.113.20' });
    const b = requestFrom({ 'x-forwarded-for': '203.0.113.21' });

    assert.equal((await checkRateLimit(a, 'booking', 1)).allowed, true);
    assert.equal((await checkRateLimit(a, 'booking', 1)).allowed, false);
    assert.equal((await checkRateLimit(a, 'other-scope', 1)).allowed, true);
    assert.equal((await checkRateLimit(b, 'booking', 1)).allowed, true);
  });

  it('starts a fresh window once the previous one has expired', async () => {
    const req = requestFrom({ 'x-forwarded-for': '203.0.113.30' });
    await checkRateLimit(req, 'window', 1);
    assert.equal((await checkRateLimit(req, 'window', 1)).allowed, false);

    mock.timers.setTime(NOW.getTime() + 60_000);
    const fresh = await checkRateLimit(req, 'window', 1);
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.resetTime, NOW.getTime() + 120_000);
  });
});

describe('rateLimitResponse', () => {
  it('returns null while requests are allowed', () => {
    assert.equal(rateLimitResponse({ allowed: true, remaining: 1, resetTime: Date.now() + 60_000 }), null);
  });

  it('returns a 429 with Retry-After when blocked', async () => {
    const response = rateLimitResponse({ allowed: false, remaining: 0, resetTime: Date.now() + 30_000 });
    assert.ok(response);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const retryAfter = Number(response.headers.get('Retry-After'));
    assert.ok(retryAfter >= 29 && retryAfter <= 30, `Retry-After was ${retryAfter}`);
    assert.deepEqual(await response.json(), { error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
  });

  it('never advertises a Retry-After below one second', () => {
    const response = rateLimitResponse({ allowed: false, remaining: 0, resetTime: Date.now() - 5_000 });
    assert.equal(response?.headers.get('Retry-After'), '1');
  });
});
