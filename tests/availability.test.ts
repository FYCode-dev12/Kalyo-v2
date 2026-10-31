import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Order matters: the fakes must be installed before lib/availability loads.
import { db, queries, resetFakePrisma, type FakeCalendarSource } from './helpers/fake-prisma';
import { eventsListCalls, fakeEvents, resetFakeGoogle, uniqueGoogleCalendarId } from './helpers/fake-google';
import { getAvailableSlots } from '@/lib/availability';

// Sunday 2026-11-01 07:00 in Asia/Jakarta (UTC+7, no DST).
const NOW = new Date('2026-11-01T00:00:00.000Z');
const MONDAY = '2026-11-09';
const SATURDAY = '2026-11-14';

/** Converts a wall-clock time in Asia/Jakarta (UTC+7) to a UTC ISO string. */
function wib(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function addCalendarSource(overrides: Partial<FakeCalendarSource> = {}): FakeCalendarSource {
  const source: FakeCalendarSource = {
    id: `source-${db.calendarSources.length + 1}`,
    googleCalendarId: uniqueGoogleCalendarId(),
    displayName: 'Kerja',
    color: '#2563eb',
    showTitle: false,
    showDescription: false,
    isBookingTarget: true,
    ...overrides,
  };
  db.calendarSources.push(source);
  return source;
}

function slotAt<T extends { formattedStart: string }>(slots: T[], start: string): T {
  const slot = slots.find((s) => s.formattedStart === start);
  assert.ok(slot, `expected a slot starting at ${start}`);
  return slot;
}

beforeEach(() => {
  resetFakePrisma();
  resetFakeGoogle();
  mock.timers.enable({ apis: ['Date'], now: NOW });
});

afterEach(() => {
  mock.timers.reset();
});

describe('getAvailableSlots: working-hours rules', () => {
  it('uses the default rule (Mon-Fri, 09:00-17:00, 30 min) when no rule is stored', async () => {
    addCalendarSource();
    const result = await getAvailableSlots({ dateStr: MONDAY });

    assert.equal(result.dateStr, MONDAY);
    assert.equal(result.isWorkday, true);
    assert.equal(result.isHoliday, false);
    assert.equal(result.slots.length, 16);
    assert.ok(result.slots.every((s) => s.available && s.reason === undefined));

    const first = result.slots[0];
    assert.equal(first.formattedStart, '09:00');
    assert.equal(first.formattedEnd, '09:30');
    assert.equal(first.startTime, wib(MONDAY, '09:00'));
    assert.equal(first.startTime, '2026-11-09T02:00:00.000Z');

    const last = result.slots[result.slots.length - 1];
    assert.equal(last.formattedStart, '16:30');
    assert.equal(last.formattedEnd, '17:00');
    assert.equal(last.endTime, '2026-11-09T10:00:00.000Z');
  });

  it('loads the singleton business rule', async () => {
    await getAvailableSlots({ dateStr: MONDAY });
    assert.deepEqual(queries['businessRule.findUnique'], [{ where: { id: 'singleton' } }]);
  });

  it('returns no slots on a non-workday without querying Google', async () => {
    addCalendarSource();
    const result = await getAvailableSlots({ dateStr: SATURDAY });

    assert.deepEqual(result, { dateStr: SATURDAY, isWorkday: false, isHoliday: false, slots: [] });
    assert.equal(eventsListCalls.length, 0);
  });

  it('respects stored workdays, working hours and slot length', async () => {
    db.businessRule = {
      workStartTime: '08:00',
      workEndTime: '12:00',
      workdays: [6],
      minNoticeHours: 1,
      slotDurationMin: 60,
    };
    addCalendarSource();

    const saturday = await getAvailableSlots({ dateStr: SATURDAY });
    assert.equal(saturday.isWorkday, true);
    assert.deepEqual(
      saturday.slots.map((s) => `${s.formattedStart}-${s.formattedEnd}`),
      ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00'],
    );

    const monday = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(monday.isWorkday, false);
    assert.deepEqual(monday.slots, []);
  });

  it('lets durationMin override the rule and drops a trailing slot that would overrun work hours', async () => {
    addCalendarSource();
    const result = await getAvailableSlots({ dateStr: MONDAY, durationMin: 90 });

    assert.deepEqual(
      result.slots.map((s) => `${s.formattedStart}-${s.formattedEnd}`),
      ['09:00-10:30', '10:30-12:00', '12:00-13:30', '13:30-15:00', '15:00-16:30'],
    );
  });

  it('rejects a malformed date string', async () => {
    await assert.rejects(getAvailableSlots({ dateStr: 'not-a-date' }), /Invalid date format/);
  });
});

describe('getAvailableSlots: Asia/Jakarta timezone', () => {
  it('defaults to Asia/Jakarta and forwards it to Google', async () => {
    const source = addCalendarSource();
    await getAvailableSlots({ dateStr: MONDAY });

    assert.equal(eventsListCalls.length, 1);
    const params = eventsListCalls[0].params;
    assert.equal(params.calendarId, source.googleCalendarId);
    assert.equal(params.timeZone, 'Asia/Jakarta');
    // The whole Jakarta calendar day, expressed in UTC.
    assert.equal(params.timeMin, '2026-11-08T17:00:00.000Z');
    assert.equal(params.timeMax, '2026-11-09T16:59:59.000Z');
  });

  it('decides the weekday in Jakarta even though the day starts on the previous UTC date', async () => {
    // 00:00 Monday in Jakarta is still Sunday 17:00 in UTC.
    const result = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(result.isWorkday, true);
  });

  it('computes slot instants in an explicitly requested timezone', async () => {
    addCalendarSource();
    const result = await getAvailableSlots({ dateStr: MONDAY, timeZone: 'UTC' });

    assert.equal(result.slots[0].startTime, '2026-11-09T09:00:00.000Z');
    assert.equal(result.slots[0].formattedStart, '09:00');
  });

  it('only counts PENDING and APPROVED requests that touch the Jakarta day', async () => {
    await getAvailableSlots({ dateStr: MONDAY });

    assert.deepEqual(queries['appointmentRequest.findMany'], [
      {
        where: {
          status: { in: ['PENDING', 'APPROVED'] },
          startDatetime: { lte: new Date('2026-11-09T16:59:59.000Z') },
          endDatetime: { gte: new Date('2026-11-08T17:00:00.000Z') },
        },
        select: { startDatetime: true, endDatetime: true },
      },
    ]);
  });
});

describe('getAvailableSlots: holidays', () => {
  it('returns no slots on a holiday and keeps its reason', async () => {
    db.holiday = { reason: 'Hari Pahlawan' };
    addCalendarSource();
    const result = await getAvailableSlots({ dateStr: MONDAY });

    assert.deepEqual(result, {
      dateStr: MONDAY,
      isWorkday: false,
      isHoliday: true,
      holidayReason: 'Hari Pahlawan',
      slots: [],
    });
    assert.equal(eventsListCalls.length, 0);
    assert.equal(queries['appointmentRequest.findMany'], undefined);
  });

  it('falls back to "Hari Libur" when the holiday has no reason', async () => {
    db.holiday = { reason: null };
    const result = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(result.holidayReason, 'Hari Libur');
  });

  it('looks the holiday up across the whole Jakarta calendar day', async () => {
    await getAvailableSlots({ dateStr: MONDAY });

    const [args] = queries['holiday.findFirst'] as { where: { date: { gte: Date; lte: Date } } }[];
    assert.equal(args.where.date.gte.toISOString(), '2026-11-08T17:00:00.000Z');
    assert.equal(args.where.date.lte.toISOString(), '2026-11-09T16:59:59.000Z');

    // The admin settings route stores a holiday as `${date}T00:00:00Z`; that
    // instant must fall inside the window for the same calendar date.
    const stored = new Date(`${MONDAY}T00:00:00Z`);
    assert.ok(stored >= args.where.date.gte && stored <= args.where.date.lte);
  });

  it('reports a holiday even when it falls on a non-workday', async () => {
    db.holiday = { reason: 'Libur' };
    const result = await getAvailableSlots({ dateStr: SATURDAY });
    assert.equal(result.isHoliday, true);
  });
});

describe('getAvailableSlots: busy events', () => {
  it('blocks every slot that overlaps a Google event', async () => {
    const source = addCalendarSource();
    fakeEvents.set(source.googleCalendarId, [
      {
        id: 'evt-1',
        summary: 'Rapat',
        start: { dateTime: wib(MONDAY, '10:15') },
        end: { dateTime: wib(MONDAY, '11:00') },
      },
    ]);

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });

    for (const start of ['10:00', '10:30']) {
      const slot = slotAt(slots, start);
      assert.equal(slot.available, false, start);
      assert.equal(slot.reason, 'Bentrok dengan jadwal kalender');
    }
    assert.equal(slotAt(slots, '09:30').available, true);
    assert.equal(slotAt(slots, '11:00').available, true);
    assert.equal(slots.filter((s) => !s.available).length, 2);
  });

  it('treats back-to-back boundaries as free', async () => {
    const source = addCalendarSource();
    fakeEvents.set(source.googleCalendarId, [
      { id: 'lunch', start: { dateTime: wib(MONDAY, '12:00') }, end: { dateTime: wib(MONDAY, '13:00') } },
    ]);

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });

    assert.equal(slotAt(slots, '11:30').available, true);
    assert.equal(slotAt(slots, '12:00').available, false);
    assert.equal(slotAt(slots, '12:30').available, false);
    assert.equal(slotAt(slots, '13:00').available, true);
  });

  it('still blocks time for masked ("Sibuk / Busy") events', async () => {
    const source = addCalendarSource({ showTitle: false });
    fakeEvents.set(source.googleCalendarId, [
      { id: 'secret', summary: 'Dokter', start: { dateTime: wib(MONDAY, '09:00') }, end: { dateTime: wib(MONDAY, '09:30') } },
    ]);

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(slotAt(slots, '09:00').available, false);
  });

  it('blocks the whole working day for an all-day Google event', async () => {
    const source = addCalendarSource();
    fakeEvents.set(source.googleCalendarId, [
      { id: 'cuti', summary: 'Cuti', start: { date: MONDAY }, end: { date: '2026-11-10' } },
    ]);

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(slots.length, 16);
    assert.ok(slots.every((s) => !s.available));
  });

  // KNOWN BUG (left unfixed on purpose, tests only): Google returns all-day
  // bounds as bare dates ("2026-11-09"), and lib/availability.ts parses them
  // with `new Date(...)`, which reads them as UTC midnight = 07:00 in Jakarta.
  // An all-day event therefore only blocks 07:00 -> 07:00 the next day, so with
  // working hours that start before 07:00 the early slots stay bookable.
  it(
    'blocks slots before 07:00 Jakarta time on an all-day event',
    { skip: 'known bug: all-day event dates are parsed as UTC midnight (07:00 WIB)' },
    async () => {
      db.businessRule = {
        workStartTime: '06:00',
        workEndTime: '09:00',
        workdays: [1],
        minNoticeHours: 1,
        slotDurationMin: 60,
      };
      const source = addCalendarSource();
      fakeEvents.set(source.googleCalendarId, [
        { id: 'cuti', start: { date: MONDAY }, end: { date: '2026-11-10' } },
      ]);

      const { slots } = await getAvailableSlots({ dateStr: MONDAY });
      assert.equal(slotAt(slots, '06:00').available, false);
    },
  );

  it('merges busy time from every calendar source', async () => {
    const work = addCalendarSource();
    const personal = addCalendarSource({ displayName: 'Pribadi' });
    fakeEvents.set(work.googleCalendarId, [
      { id: 'a', start: { dateTime: wib(MONDAY, '09:00') }, end: { dateTime: wib(MONDAY, '09:30') } },
    ]);
    fakeEvents.set(personal.googleCalendarId, [
      { id: 'b', start: { dateTime: wib(MONDAY, '16:30') }, end: { dateTime: wib(MONDAY, '17:00') } },
    ]);

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(slotAt(slots, '09:00').available, false);
    assert.equal(slotAt(slots, '16:30').available, false);
    assert.equal(slots.filter((s) => !s.available).length, 2);
  });

  it('blocks slots that overlap an existing appointment request', async () => {
    addCalendarSource();
    db.appointments = [
      { startDatetime: new Date(wib(MONDAY, '14:00')), endDatetime: new Date(wib(MONDAY, '14:30')) },
    ];

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });
    const slot = slotAt(slots, '14:00');
    assert.equal(slot.available, false);
    assert.equal(slot.reason, 'Sudah ada permintaan janji temu di jam ini');
    assert.equal(slotAt(slots, '13:30').available, true);
    assert.equal(slotAt(slots, '14:30').available, true);
  });

  it('reports the calendar conflict when a slot overlaps both kinds of busy time', async () => {
    const source = addCalendarSource();
    fakeEvents.set(source.googleCalendarId, [
      { id: 'x', start: { dateTime: wib(MONDAY, '15:00') }, end: { dateTime: wib(MONDAY, '15:30') } },
    ]);
    db.appointments = [
      { startDatetime: new Date(wib(MONDAY, '15:00')), endDatetime: new Date(wib(MONDAY, '15:30')) },
    ];

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });
    assert.equal(slotAt(slots, '15:00').reason, 'Bentrok dengan jadwal kalender');
  });

  it('restricts calendar sources to the requested booking target', async () => {
    addCalendarSource();
    await getAvailableSlots({ dateStr: MONDAY, calendarSourceId: 'source-1' });
    await getAvailableSlots({ dateStr: MONDAY });

    const calls = queries['calendarSource.findMany'] as { where: unknown }[];
    assert.deepEqual(calls[0].where, { id: 'source-1', isBookingTarget: true });
    assert.equal(calls[1].where, undefined);
  });
});

describe('getAvailableSlots: minimum notice', () => {
  it('blocks slots that start before now + minNoticeHours', async () => {
    // Monday 07:00 Jakarta, with 4 hours of notice: the threshold is 11:00.
    mock.timers.setTime(new Date(wib(MONDAY, '07:00')).getTime());
    db.businessRule = {
      workStartTime: '09:00',
      workEndTime: '17:00',
      workdays: [1, 2, 3, 4, 5],
      minNoticeHours: 4,
      slotDurationMin: 30,
    };
    addCalendarSource();

    const { slots } = await getAvailableSlots({ dateStr: MONDAY });

    for (const start of ['09:00', '09:30', '10:00', '10:30']) {
      const slot = slotAt(slots, start);
      assert.equal(slot.available, false, start);
      assert.equal(slot.reason, 'Membutuhkan minimal notice 4 jam');
    }
    // A slot starting exactly at the threshold is allowed.
    assert.equal(slotAt(slots, '11:00').available, true);
  });

  it('applies the default 24 hour notice when no rule is stored', async () => {
    mock.timers.setTime(new Date(wib(MONDAY, '12:00')).getTime());
    addCalendarSource();

    const monday = await getAvailableSlots({ dateStr: MONDAY });
    assert.ok(monday.slots.every((s) => !s.available && s.reason === 'Membutuhkan minimal notice 24 jam'));

    const tuesday = await getAvailableSlots({ dateStr: '2026-11-10' });
    assert.equal(slotAt(tuesday.slots, '11:30').available, false);
    assert.equal(slotAt(tuesday.slots, '12:00').available, true);
  });
});
