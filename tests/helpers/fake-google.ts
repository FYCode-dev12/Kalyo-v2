/**
 * Replaces the Google Calendar client used by lib/google-calendar.ts with an
 * in-memory fake. Import this module BEFORE any module that imports
 * lib/google-calendar so the fake is in place before the first client is built.
 */
import { google } from 'googleapis';

export interface FakeGoogleEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}

export interface EventsListCall {
  params: Record<string, unknown>;
  options: Record<string, unknown> | undefined;
}

/** Events returned per Google calendar id. */
export const fakeEvents = new Map<string, FakeGoogleEvent[]>();
/** Google calendar ids whose events.list call should reject. */
export const failingCalendars = new Set<string>();
/** Every events.list call, in order. */
export const eventsListCalls: EventsListCall[] = [];

const fakeCalendarClient = {
  events: {
    async list(params: Record<string, unknown>, options?: Record<string, unknown>) {
      eventsListCalls.push({ params, options });
      const calendarId = String(params.calendarId);
      if (failingCalendars.has(calendarId)) {
        throw new Error(`simulated Google failure for ${calendarId}`);
      }
      return { data: { items: fakeEvents.get(calendarId) ?? [] } };
    },
  },
};

// Dummy credentials: getGoogleCalendarClient only checks that they exist.
// The fake client never performs a network request, so they are never used.
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test-runner@example.iam.gserviceaccount.com';
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'not-a-real-key';

google.calendar = (() => fakeCalendarClient) as unknown as typeof google.calendar;

let counter = 0;
/**
 * fetchMergedEvents caches results by calendar id + time range, so each test
 * uses a fresh Google calendar id to stay independent of the others.
 */
export function uniqueGoogleCalendarId(label = 'cal'): string {
  counter += 1;
  return `${label}-${counter}@group.calendar.google.com`;
}

export function resetFakeGoogle(): void {
  fakeEvents.clear();
  failingCalendars.clear();
  eventsListCalls.length = 0;
}
