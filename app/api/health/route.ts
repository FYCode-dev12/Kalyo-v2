import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', checks: { database: 'ok' }, latencyMs: Date.now() - startedAt }, { status: 200 });
  } catch (error) {
    console.error('[Health] Database check failed:', error);
    return NextResponse.json({ status: 'degraded', checks: { database: 'failed' } }, { status: 503 });
  }
}
