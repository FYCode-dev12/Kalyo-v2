import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Legacy credential login is intentionally disabled.
 * Admin access must go through the Google OAuth allowlist.
 */
export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'admin-login', 5);
  const limited = rateLimitResponse(rateLimit);
  if (limited) return limited;

  return Response.json(
    { error: 'Gunakan login dengan Google.' },
    { status: 410 },
  );
}
