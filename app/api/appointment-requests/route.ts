import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appointmentRequestSchema } from '@/lib/validations/appointment';
import { fetchMergedEvents } from '@/lib/google-calendar';
import { getAvailableSlots } from '@/lib/availability';
import { formatInTimeZone } from 'date-fns-tz';
import type { CalendarSourceConfig } from '@/types/calendar';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, 'appointment-create', 5);
    const limited = rateLimitResponse(rateLimit);
    if (limited) return limited;
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
    const dateStr = formatInTimeZone(reqStart, 'Asia/Jakarta', 'yyyy-MM-dd');

    // Re-validate that the submitted range is an actually available server slot.
    const availability = await getAvailableSlots({ dateStr, timeZone: 'Asia/Jakarta' });
    const requestedSlot = availability.slots.find(
      (slot) => slot.startTime === reqStart.toISOString() && slot.endTime === reqEnd.toISOString()
    );
    if (!requestedSlot || !requestedSlot.available) {
      return NextResponse.json(
        { error: requestedSlot?.reason || 'Slot waktu yang dipilih tidak tersedia.' },
        { status: 409 }
      );
    }

    // 2. Check overlap with Google Calendar
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

    // 4. Check and insert atomically to prevent double booking races.
    const created = await prisma.$transaction(async (tx) => {
      const dbConflict = await tx.appointmentRequest.findFirst({
        where: {
          status: { in: ['PENDING', 'APPROVED'] },
          startDatetime: { lt: reqEnd },
          endDatetime: { gt: reqStart },
        },
      });

      if (dbConflict) {
        throw new Error('SLOT_ALREADY_BOOKED');
      }

      return tx.appointmentRequest.create({
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
    }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        statusToken: created.statusToken,
        status: created.status,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SLOT_ALREADY_BOOKED') {
      return NextResponse.json(
        { error: 'Slot waktu yang dipilih sudah tidak tersedia (sudah dipesan).' },
        { status: 409 }
      );
    }

    console.error('[API /api/appointment-requests] Error:', err);
    return NextResponse.json(
      { error: 'Gagal membuat permintaan janji temu.' },
      { status: 500 }
    );
  }
}
