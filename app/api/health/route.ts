import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export async function GET() {
  // The previous version reported live DB reachability and latency to anyone,
  // giving anonymous attackers a free oracle for probing infra health.
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', checks: { database: 'ok' }, latencyMs: Date.now() - startedAt }, { status: 200 });
  } catch (error) {
    console.error('[Health] Database check failed:', error);
    return NextResponse.json({ status: 'degraded', checks: { database: 'failed' } }, { status: 503 });
  }
}
