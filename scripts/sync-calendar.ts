import { prisma } from '@/lib/prisma';
import { fetchMergedEvents } from '@/lib/google-calendar';
import type { CalendarSourceConfig } from '@/types/calendar';

/**
 * Sync Calendar Script
 * Fetches events from Google Calendar sources and merges with local DB
 * Use: pnpm tsx scripts/sync-calendar.ts
 */

async function syncCalendar() {
  console.log('[SyncCalendar] Starting sync...');

  try {
    // 1. Fetch all active calendar sources
    const calendarSources = await prisma.calendarSource.findMany({
      where: { isBookingTarget: false }, // Exclude booking target (it's for admin use only)
    });

    if (calendarSources.length === 0) {
      console.log('[SyncCalendar] No calendar sources found. Skipping sync.');
      return;
    }

    const calConfigs: CalendarSourceConfig[] = calendarSources.map((c) => ({
      id: c.id,
      googleCalendarId: c.googleCalendarId,
      displayName: c.displayName,
      color: c.color,
      showTitle: c.showTitle,
      showDescription: c.showDescription,
      isBookingTarget: c.isBookingTarget,
    }));

    console.log(`[SyncCalendar] Found ${calConfigs.length} calendar sources`);

    // 2. Fetch events from last 7 days to next 30 days (balance between data freshness and sync load)
    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    const googleEvents = await fetchMergedEvents(calConfigs, timeMin, timeMax, 'Asia/Jakarta');

    console.log(`[SyncCalendar] Fetched ${googleEvents.length} events from Google Calendar`);

    // 3. Get existing events from DB
    const dbEvents = await prisma.appointmentRequest.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        googleEventId: { not: null },
      },
    });

    const dbEventMap = new Map(dbEvents.map((e) => [e.googleEventId, e]));

    // 4. Sync: Create/update events from Google Calendar to DB
    let createdCount = 0;
    const updatedCount = 0;

    for (const event of googleEvents) {
      if (!event.rawGoogleId || !event.isMasked) {
        // Skip non-booking events
        continue;
      }

      const existing = dbEventMap.get(event.rawGoogleId);

      if (!existing) {
        // Create new appointment request from Google event
        const start = new Date(event.start);
        const end = new Date(event.end);

        // Skip all-day events for now
        if (event.allDay) continue;

        await prisma.appointmentRequest.create({
          data: {
            requesterName: event.title === 'Sibuk / Busy' ? 'Calendar Block' : event.title,
            requesterEmail: 'calendar.sync@kalyo.app',
            startDatetime: start,
            endDatetime: end,
            status: 'APPROVED',
            googleEventId: event.rawGoogleId,
          },
        });
        createdCount++;
        console.log(`[SyncCalendar] Created appointment: ${event.title} (${start.toLocaleString()})`);
      }
    }

    console.log(`[SyncCalendar] Sync complete: ${createdCount} created, ${updatedCount} updated`);

    // 5. Log sync event
    await prisma.notificationLog.create({
      data: {
        appointmentRequestId: 'system', // System sync
        type: 'SYSTEM_SYNC',
        status: 'COMPLETED',
        sentAt: new Date(),
      },
    });

    process.exit(0);
  } catch (err) {
    console.error('[SyncCalendar] Error:', err);
    process.exit(1);
  }
}

syncCalendar();
