import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export async function GET() {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await prisma.appointmentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data: requests });
  } catch (err: unknown) {
    console.error('[API /api/admin/appointment-requests] Error:', err);
    return NextResponse.json(
      { error: 'Gagal mengambil data permintaan janji temu.' },
      { status: 500 }
    );
  }
}
