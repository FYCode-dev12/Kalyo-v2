/**
 * In-memory stand-in for the Prisma client. lib/prisma.ts reuses
 * `globalThis.prisma` when it is set (outside production), so importing this
 * module BEFORE lib/prisma injects the fake without touching app code.
 */

export interface FakeBusinessRule {
  workStartTime: string;
  workEndTime: string;
  workdays: number[];
  minNoticeHours: number;
  slotDurationMin: number;
}

export interface FakeCalendarSource {
  id: string;
  googleCalendarId: string;
  displayName: string;
  color: string;
  showTitle: boolean;
  showDescription: boolean;
  isBookingTarget: boolean;
}

export interface FakeAppointment {
  startDatetime: Date;
  endDatetime: Date;
}

export interface FakeDbState {
  businessRule: FakeBusinessRule | null;
  holiday: { reason: string | null } | null;
  calendarSources: FakeCalendarSource[];
  appointments: FakeAppointment[];
}

export const db: FakeDbState = {
  businessRule: null,
  holiday: null,
  calendarSources: [],
  appointments: [],
};

/** Arguments of every query, keyed by "model.method". */
export const queries: Record<string, unknown[]> = {};

function record(name: string, args: unknown) {
  (queries[name] ??= []).push(args);
}

const fakePrisma = {
  businessRule: {
    async findUnique(args: unknown) {
      record('businessRule.findUnique', args);
      return db.businessRule;
    },
  },
  holiday: {
    async findFirst(args: unknown) {
      record('holiday.findFirst', args);
      return db.holiday;
    },
  },
  calendarSource: {
    async findMany(args: unknown) {
      record('calendarSource.findMany', args);
      return db.calendarSources;
    },
  },
  appointmentRequest: {
    async findMany(args: unknown) {
      record('appointmentRequest.findMany', args);
      return db.appointments;
    },
  },
};

(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

export function resetFakePrisma(): void {
  db.businessRule = null;
  db.holiday = null;
  db.calendarSources = [];
  db.appointments = [];
  for (const key of Object.keys(queries)) delete queries[key];
}
