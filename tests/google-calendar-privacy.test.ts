import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Order matters: the fake Google client must be installed first.
import { eventsListCalls, failingCalendars, fakeEvents, resetFakeGoogle, uniqueGoogleCalendarId } from './helpers/fake-google';
import { fetchMergedEvents, getGoogleCalendarClient } from '@/lib/google-calendar';
import type { CalendarSourceConfig } from '@/types/calendar';

const TIME_MIN = new Date('2026-11-08T17:00:00.000Z');
const TIME_MAX = new Date('2026-11-09T16:59:59.000Z');

function calendar(overrides: Partial<CalendarSourceConfig> = {}): CalendarSourceConfig {
  return {
    id: 'db-calendar-id',
    googleCalendarId: uniqueGoogleCalendarId(),
    displayName: 'Pribadi',
    color: '#16a34a',
    showTitle: false,
    showDescription: false,
    isBookingTarget: false,
    ...overrides,
  };
}

const PRIVATE_EVENT = {
  id: 'evt-1',
  summary: 'Konsultasi dokter gigi',
  description: 'Klinik di Jl. Contoh No. 1',
  start: { dateTime: '2026-11-09T10:00:00+07:00' },
  end: { dateTime: '2026-11-09T11:00:00+07:00' },
};

beforeEach(() => {
  resetFakeGoogle();
});

afterEach(() => {
  mock.restoreAll();
});

describe('fetchMergedEvents: privacy masking', () => {
  it('replaces the title of private calendars with "Sibuk / Busy" and drops the description', async () => {
    const cal = calendar({ showTitle: false, showDescription: false });
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);

    assert.equal(event.title, 'Sibuk / Busy');
    assert.equal(event.isMasked, true);
    assert.equal(event.description, null);
    // Nothing from the private event text may leak into the payload.
    const serialized = JSON.stringify(event);
    assert.ok(!serialized.includes(PRIVATE_EVENT.summary));
    assert.ok(!serialized.includes(PRIVATE_EVENT.description));
  });

  it('keeps the timing of masked events so they still render as busy', async () => {
    const cal = calendar();
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.start, PRIVATE_EVENT.start.dateTime);
    assert.equal(event.end, PRIVATE_EVENT.end.dateTime);
    assert.equal(event.allDay, false);
  });

  it('shows the real title on public calendars', async () => {
    const cal = calendar({ showTitle: true });
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.title, PRIVATE_EVENT.summary);
    assert.equal(event.isMasked, false);
  });

  it('hides the description when only the title is public', async () => {
    const cal = calendar({ showTitle: true, showDescription: false });
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.description, null);
  });

  it('passes the description through when the calendar allows it', async () => {
    const cal = calendar({ showTitle: true, showDescription: true });
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.description, PRIVATE_EVENT.description);
  });

  it('uses "(Tanpa judul)" for untitled events on public calendars', async () => {
    const cal = calendar({ showTitle: true });
    fakeEvents.set(cal.googleCalendarId, [{ ...PRIVATE_EVENT, summary: undefined }]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.title, '(Tanpa judul)');
  });

  it('never exposes the raw Google calendar id', async () => {
    const cal = calendar({ id: 'source-uuid', googleCalendarId: 'owner.private@example.com', showTitle: true });
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.id, 'source-uuid_evt-1');
    assert.equal(event.calendarId, 'source-uuid');
    assert.equal(event.calendarName, 'Pribadi');
    assert.equal(event.color, '#16a34a');
    assert.ok(!JSON.stringify(event).includes('owner.private@example.com'));
  });

  it('only asks Google for the fields it needs', async () => {
    const cal = calendar();
    await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);

    assert.equal(eventsListCalls.length, 1);
    const { params } = eventsListCalls[0];
    assert.equal(params.fields, 'items(id,summary,description,start,end)');
    assert.equal(params.singleEvents, true);
    assert.equal(params.timeZone, 'Asia/Jakarta');
    assert.equal(params.timeMin, TIME_MIN.toISOString());
    assert.equal(params.timeMax, TIME_MAX.toISOString());
  });
});

describe('fetchMergedEvents: merging', () => {
  it('flags all-day events and keeps their date-only bounds', async () => {
    const cal = calendar();
    fakeEvents.set(cal.googleCalendarId, [
      { id: 'cuti', summary: 'Cuti', start: { date: '2026-11-09' }, end: { date: '2026-11-10' } },
    ]);

    const [event] = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);
    assert.equal(event.allDay, true);
    assert.equal(event.start, '2026-11-09');
    assert.equal(event.end, '2026-11-10');
  });

  it('merges events from several calendars, each masked by its own settings', async () => {
    const work = calendar({ id: 'work', showTitle: true });
    const personal = calendar({ id: 'personal', showTitle: false });
    fakeEvents.set(work.googleCalendarId, [{ ...PRIVATE_EVENT, id: 'w1', summary: 'Kuliah' }]);
    fakeEvents.set(personal.googleCalendarId, [{ ...PRIVATE_EVENT, id: 'p1' }]);

    const events = await fetchMergedEvents([work, personal], TIME_MIN, TIME_MAX);
    assert.deepEqual(
      events.map((e) => [e.id, e.title, e.isMasked]),
      [
        ['work_w1', 'Kuliah', false],
        ['personal_p1', 'Sibuk / Busy', true],
      ],
    );
  });

  it('skips a calendar that fails instead of failing the whole request', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    const broken = calendar({ id: 'broken' });
    const healthy = calendar({ id: 'healthy' });
    failingCalendars.add(broken.googleCalendarId);
    fakeEvents.set(healthy.googleCalendarId, [PRIVATE_EVENT]);

    const events = await fetchMergedEvents([broken, healthy], TIME_MIN, TIME_MAX);
    assert.deepEqual(events.map((e) => e.calendarId), ['healthy']);
    assert.equal(consoleError.mock.callCount(), 1);
  });

  it('serves repeated identical requests from the short-lived cache', async () => {
    const cal = calendar();
    fakeEvents.set(cal.googleCalendarId, [PRIVATE_EVENT]);

    const [first, second] = await Promise.all([
      fetchMergedEvents([cal], TIME_MIN, TIME_MAX),
      fetchMergedEvents([cal], TIME_MIN, TIME_MAX),
    ]);
    const third = await fetchMergedEvents([cal], TIME_MIN, TIME_MAX);

    assert.equal(eventsListCalls.length, 1);
    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
  });
});

describe('getGoogleCalendarClient', () => {
  it('refuses to build a client without service account credentials', () => {
    const saved = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    try {
      assert.throws(() => getGoogleCalendarClient(), /credentials missing/);
    } finally {
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = saved;
    }
  });
});
