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
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    // Without bounds an anonymous request can ask for a century of events and
    // exhaust the Google Calendar API quota for every other visitor.
    if (endMax <= startMin) {
      return NextResponse.json({ error: '"end" must be later than "start"' }, { status: 400 });
    }
    const MAX_RANGE_DAYS = 92;
    if ((endMax.getTime() - startMin.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Maksimal rentang tanggal adalah ${MAX_RANGE_DAYS} hari.` },
        { status: 400 }
      );
    }

    const calendarSources = await prisma.calendarSource.findMany({
      where: { showOnPublic: true },
      select: {
        id: true,
        googleCalendarId: true,
        displayName: true,
        color: true,
        showTitle: true,
        showDescription: true,
        isBookingTarget: true,
      },
    });

    const calendars: CalendarSourceConfig[] = calendarSources.map((source) => ({
      id: source.id,
      googleCalendarId: source.googleCalendarId,
      displayName: source.displayName,
      color: source.color,
      showTitle: source.showTitle,
      showDescription: source.showDescription,
      isBookingTarget: source.isBookingTarget,
    }));

    const data = await fetchMergedEvents(calendars, startMin, endMax, 'Asia/Jakarta');
    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' } }
    );
  } catch (err: unknown) {
    console.error('[API /api/google-events] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Google calendar events' },
      { status: 502 }
    );
  }
}
