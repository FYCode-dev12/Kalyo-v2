/**
 * Scheduled Calendar Sync Job
 * Syncs Google Calendar events to local DB every 30 minutes
 * Uses Upstash cron for serverless environments (Vercel/Netlify)
 */

import { prisma } from '@/lib/prisma';
import { fetchMergedEvents } from '@/lib/google-calendar';
import type { CalendarSourceConfig } from '@/types/calendar';

export async function syncCalendarJob() {
  console.log(`[SyncJob] Starting calendar sync...`);

  try {
    // Fetch only booking target calendars (for appointments)
    const calendarSources = await prisma.calendarSource.findMany({
      where: { isBookingTarget: true },
    });

    if (calendarSources.length === 0) {
      console.log('[SyncJob] No booking calendars configured. Skipping.');
      return { synced: 0, error: null };
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

    // Time range: last 24h to next 30 days
    const now = new Date();
    const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const googleEvents = await fetchMergedEvents(calConfigs, timeMin, timeMax, 'Asia/Jakarta');

    // Sync to DB
    let createdCount = 0;
    const updatedCount = 0;

    for (const event of googleEvents) {
      if (!event.rawGoogleId || !event.isMasked) continue;

      const start = new Date(event.start);
      const end = new Date(event.end);

      if (event.allDay) continue;

      // Use findFirst instead of findUnique since googleEventId is not unique
      const existing = await prisma.appointmentRequest.findFirst({
        where: { googleEventId: event.rawGoogleId },
      });

      if (!existing) {
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
        console.log(`[SyncJob] Created appointment: ${event.title}`);
      }
    }

    console.log(`[SyncJob] Sync complete: ${createdCount} created, ${updatedCount} updated`);

    return { synced: createdCount + updatedCount, error: null };
  } catch (err) {
    console.error('[SyncJob] Error:', err);
    return { synced: 0, error: err };
  }
}

// Export for cron execution
if (require.main === module) {
  syncCalendarJob()
    .then((result) => {
      console.log('[Cron] Result:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Cron] Fatal error:', err);
      process.exit(1);
    });
}
