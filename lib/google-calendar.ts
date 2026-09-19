import { google } from 'googleapis';
import type { CalendarSourceConfig, UnifiedEvent } from '@/types/calendar';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export function getGoogleCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment variables');
  }

  // Environment variables commonly store PEM line breaks as literal \\n.
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch merged events across multiple calendar sources in parallel with privacy masking.
 */
export async function fetchMergedEvents(
  calendars: CalendarSourceConfig[],
  timeMin: Date,
  timeMax: Date,
  timeZone = 'Asia/Jakarta'
): Promise<UnifiedEvent[]> {
  const calendar = getGoogleCalendarClient();

  const promises = calendars.map(async (cal) => {
    try {
      const response = await calendar.events.list({
        calendarId: cal.googleCalendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone,
      });

      const items = response.data.items ?? [];

      return items.map((item): UnifiedEvent => {
        const isAllDay = !item.start?.dateTime && Boolean(item.start?.date);
        const start = item.start?.dateTime || item.start?.date || timeMin.toISOString();
        const end = item.end?.dateTime || item.end?.date || timeMax.toISOString();

        // Privacy rules
        const isMasked = !cal.showTitle;
        const title = cal.showTitle ? (item.summary || '(Tanpa judul)') : 'Sibuk / Busy';
        const description = cal.showDescription ? item.description : null;

        return {
          id: `${cal.googleCalendarId}_${item.id}`,
          rawGoogleId: item.id || undefined,
          title,
          description,
          start,
          end,
          allDay: isAllDay,
          calendarId: cal.googleCalendarId,
          calendarName: cal.displayName,
          color: cal.color,
          isMasked,
        };
      });
    } catch (err: unknown) {
      console.error(`[GoogleCalendar] Error fetching calendar "${cal.displayName}" (${cal.googleCalendarId}):`, err);
      // Graceful degradation: return empty array so one failed calendar doesn't break the entire view
      return [];
    }
  });

  const results = await Promise.all(promises);
  return results.flat();
}

/**
 * Create an event on Google Calendar (e.g. when an appointment is approved).
 */
export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone?: string;
}): Promise<string> {
  const calendar = getGoogleCalendarClient();
  const tz = params.timeZone || 'Asia/Jakarta';

  const res = await calendar.events.insert({
    calendarId: params.calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startIso,
        timeZone: tz,
      },
      end: {
        dateTime: params.endIso,
        timeZone: tz,
      },
    },
  });

  if (!res.data.id) {
    throw new Error('Google Calendar did not return an event ID');
  }

  return res.data.id;
}

/**
 * Delete an event from Google Calendar (e.g. when rejected or cancelled).
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getGoogleCalendarClient();
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}
