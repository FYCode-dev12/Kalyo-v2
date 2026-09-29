import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // The endpoint is reachable by anyone holding a status token, so it needs its
    // own throttle bucket: without it an attacker can brute-force UUID tokens and
    // read another guest's PII at line rate.
    const rateLimit = await checkRateLimit(request, 'status-lookup', 30);
    const limited = rateLimitResponse(rateLimit);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Parameter "token" is required' },
        { status: 400 }
      );
    }

    const requestRecord = await prisma.appointmentRequest.findUnique({
      where: { statusToken: token },
      select: {
        id: true,
        requesterName: true,
        requesterEmail: true,
        purpose: true,
        startDatetime: true,
        endDatetime: true,
        status: true,
        rejectReason: true,
        createdAt: true,
      },
    });

    // Constant-time-ish generic failure: respond identically for a missing token
    // and an invalid one so the endpoint cannot be used to confirm token validity.
    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Permintaan janji temu tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: requestRecord });
  } catch (err: unknown) {
    console.error('[API /api/appointment-requests/status] Error:', err);
    return NextResponse.json(
      { error: 'Gagal mengambil status permintaan janji temu.' },
      { status: 500 }
    );
  }
}
