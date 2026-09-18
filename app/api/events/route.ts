import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchMergedEvents } from '@/lib/google-calendar';
import type { CalendarSourceConfig } from '@/types/calendar';

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
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // 1. Fetch active calendar sources
    const calendarSources = await prisma.calendarSource.findMany();
    const calConfigs: CalendarSourceConfig[] = calendarSources.map((c) => ({
      id: c.id,
      googleCalendarId: c.googleCalendarId,
      displayName: c.displayName,
      color: c.color,
      showTitle: c.showTitle,
      showDescription: c.showDescription,
      isBookingTarget: c.isBookingTarget,
    }));

    // 2. Fetch Google Calendar events
    const googleEvents = await fetchMergedEvents(calConfigs, startMin, endMax, 'Asia/Jakarta');

    // 3. Fetch APPROVED or PENDING AppointmentRequests from DB
    const dbAppointments = await prisma.appointmentRequest.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        startDatetime: { lte: endMax },
        endDatetime: { gte: startMin },
      },
    });

    const appointmentEvents = dbAppointments.map((app) => ({
      id: `app_${app.id}`,
      title: app.status === 'APPROVED' ? 'Janji Temu Terkonfirmasi' : 'Janji Temu Pending',
      start: app.startDatetime.toISOString(),
      end: app.endDatetime.toISOString(),
      allDay: false,
      calendarId: 'kalyo_requests',
      calendarName: 'Janji Temu',
      color: app.status === 'APPROVED' ? '#1769aa' : '#f9ab00',
      isMasked: true,
    }));

    // Merge Google events & active appointment requests
    const mergedEvents = [...googleEvents, ...appointmentEvents];

    return NextResponse.json({ data: mergedEvents });
  } catch (err: unknown) {
    console.error('[API /api/events] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
