import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
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
