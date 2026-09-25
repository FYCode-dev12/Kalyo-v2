import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'Parameters "start" and "end" are required (ISO 8601)' },
        { status: 400 }
      );
    }

    const startMin = new Date(startStr);
    const endMax = new Date(endStr);
    if (isNaN(startMin.getTime()) || isNaN(endMax.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const appointments = await prisma.appointmentRequest.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        startDatetime: { lte: endMax },
        endDatetime: { gte: startMin },
      },
      select: {
        id: true,
        status: true,
        startDatetime: true,
        endDatetime: true,
      },
    });

    const data = appointments.map((appointment) => ({
      id: `app_${appointment.id}`,
      title: appointment.status === 'APPROVED'
        ? 'Janji Temu Terkonfirmasi'
        : 'Janji Temu Pending',
      start: appointment.startDatetime.toISOString(),
      end: appointment.endDatetime.toISOString(),
      allDay: false,
      calendarId: 'kalyo_requests',
      calendarName: 'Janji Temu',
      color: appointment.status === 'APPROVED' ? '#1769aa' : '#f9ab00',
      isMasked: true,
    }));

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'public, max-age=5, stale-while-revalidate=10' } }
    );
  } catch (err: unknown) {
    console.error('[API /api/events] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch appointment events' },
      { status: 500 }
    );
  }
}
