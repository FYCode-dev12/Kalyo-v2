import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const calendars = await prisma.calendarSource.findMany({
      where: { OR: [{ showOnPublic: true }, { isBookingTarget: true }] },
      select: {
        id: true,
        displayName: true,
        color: true,
        isBookingTarget: true,
        showOnPublic: true,
      },
      orderBy: { displayName: 'asc' },
    });

    return NextResponse.json(
      { data: calendars.map((calendar) => ({ ...calendar, showOnPublic: calendar.showOnPublic })) },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[API /api/public-calendars] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch public calendars' }, { status: 500 });
  }
}
