import { google } from 'googleapis';
import type { CalendarSourceConfig, UnifiedEvent } from '@/types/calendar';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const GOOGLE_EVENTS_CACHE_TTL_MS = 15_000;
const eventsCache = new Map<string, { expiresAt: number; value: UnifiedEvent[] }>();
const eventsInFlight = new Map<string, Promise<UnifiedEvent[]>>();
const GOOGLE_CALENDAR_REQUEST_TIMEOUT_MS = 3_000;
let cachedCalendarClient: ReturnType<typeof google.calendar> | undefined;
let cachedCredentialFingerprint: string | undefined;

export function getGoogleCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment variables');
  }

  // Environment variables commonly store PEM line breaks as literal \\n.
  privateKey = privateKey.replace(/\\n/g, '\n');

  const credentialFingerprint = `${email}:${privateKey.length}`;
  if (cachedCalendarClient && cachedCredentialFingerprint === credentialFingerprint) {
    return cachedCalendarClient;
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });

  cachedCalendarClient = google.calendar({ version: 'v3', auth });
  cachedCredentialFingerprint = credentialFingerprint;
  return cachedCalendarClient;
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
  const cacheKey = JSON.stringify({
    calendars: calendars.map((cal) => [cal.googleCalendarId, cal.showTitle, cal.showDescription, cal.color]),
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    timeZone,
  });
  const cached = eventsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = eventsInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async (): Promise<UnifiedEvent[]> => {
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
        fields: 'items(id,summary,description,start,end)',
      }, {
        timeout: GOOGLE_CALENDAR_REQUEST_TIMEOUT_MS,
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
  const merged = results.flat();
  if (eventsCache.size >= 100) {
    const oldestKey = eventsCache.keys().next().value;
    if (oldestKey) eventsCache.delete(oldestKey);
  }
    eventsCache.set(cacheKey, { expiresAt: Date.now() + GOOGLE_EVENTS_CACHE_TTL_MS, value: merged });
    return merged;
  })();

  eventsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    eventsInFlight.delete(cacheKey);
  }
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
