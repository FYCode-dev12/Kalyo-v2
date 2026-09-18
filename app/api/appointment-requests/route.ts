import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appointmentRequestSchema } from '@/lib/validations/appointment';
import { fetchMergedEvents } from '@/lib/google-calendar';
import type { CalendarSourceConfig } from '@/types/calendar';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate payload with Zod
    const validationResult = appointmentRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validasi gagal',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const reqStart = new Date(data.startDatetime);
    const reqEnd = new Date(data.endDatetime);

    // 2. Check overlap in DB (PENDING or APPROVED)
    const dbConflict = await prisma.appointmentRequest.findFirst({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        startDatetime: { lt: reqEnd },
        endDatetime: { gt: reqStart },
      },
    });

    if (dbConflict) {
      return NextResponse.json(
        { error: 'Slot waktu yang dipilih sudah tidak tersedia (sudah dipesan).' },
        { status: 409 }
      );
    }

    // 3. Check overlap with Google Calendar
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

    const googleEvents = await fetchMergedEvents(calConfigs, reqStart, reqEnd, 'Asia/Jakarta');
    const gConflict = googleEvents.some((evt) => {
      const gStart = new Date(evt.start).getTime();
      const gEnd = new Date(evt.end).getTime();
      return reqStart.getTime() < gEnd && reqEnd.getTime() > gStart;
    });

    if (gConflict) {
      return NextResponse.json(
        { error: 'Slot waktu yang dipilih bentrok dengan kalender.' },
        { status: 409 }
      );
    }

    // 4. Create AppointmentRequest record in DB
    const created = await prisma.appointmentRequest.create({
      data: {
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        requesterPhone: data.requesterPhone || null,
        purpose: data.purpose || null,
        startDatetime: reqStart,
        endDatetime: reqEnd,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        statusToken: created.statusToken,
        status: created.status,
      },
    });
  } catch (err: unknown) {
    console.error('[API /api/appointment-requests] Error:', err);
    return NextResponse.json(
      { error: 'Gagal membuat permintaan janji temu.' },
      { status: 500 }
    );
  }
}
