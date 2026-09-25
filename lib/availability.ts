import { prisma } from '@/lib/prisma';
import { fetchMergedEvents } from '@/lib/google-calendar';
import type { TimeSlot, AvailabilityParams } from '@/types/availability';
import type { CalendarSourceConfig } from '@/types/calendar';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const DEFAULT_TZ = 'Asia/Jakarta';

/**
 * Calculates available time slots for a specific date (YYYY-MM-DD).
 */
export async function getAvailableSlots(params: AvailabilityParams): Promise<{
  dateStr: string;
  isWorkday: boolean;
  isHoliday: boolean;
  holidayReason?: string;
  slots: TimeSlot[];
}> {
  const { dateStr, durationMin, timeZone = DEFAULT_TZ, calendarSourceId } = params;

  const defaultRule = {
    workStartTime: '09:00',
    workEndTime: '17:00',
    workdays: [1, 2, 3, 4, 5],
    minNoticeHours: 24,
    slotDurationMin: 30,
  };

  // Load independent database inputs together to avoid serial round trips.
  const [storedRule, holiday] = await Promise.all([
    prisma.businessRule.findUnique({ where: { id: 'singleton' } }),
    prisma.holiday.findFirst({
      where: { date: { gte: fromZonedTime(`${dateStr}T00:00:00`, timeZone), lte: fromZonedTime(`${dateStr}T23:59:59`, timeZone) } },
      select: { reason: true },
    }),
  ]);
  const rule = storedRule || defaultRule;

  const slotDuration = durationMin || rule.slotDurationMin || 30;

  // 2. Parse date in target timezone
  // Parse "YYYY-MM-DD" as local date in target timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  // Construct start and end of day in target timezone
  const startOfDayStr = `${dateStr}T00:00:00`;
  const endOfDayStr = `${dateStr}T23:59:59`;

  const startOfDay = fromZonedTime(startOfDayStr, timeZone);
  const endOfDay = fromZonedTime(endOfDayStr, timeZone);

  if (holiday) {
    return {
      dateStr,
      isWorkday: false,
      isHoliday: true,
      holidayReason: holiday.reason || 'Hari Libur',
      slots: [],
    };
  }

  // 4. Check Workdays (0 = Sun, 1 = Mon, ... 6 = Sat)
  // Use day of week in target timezone
  const zonedDate = toZonedTime(startOfDay, timeZone);
  const dayOfWeek = zonedDate.getDay();

  const isWorkday = rule.workdays.includes(dayOfWeek);
  if (!isWorkday) {
    return {
      dateStr,
      isWorkday: false,
      isHoliday: false,
      slots: [],
    };
  }

  // 5. Minimum Notice Threshold (now + minNoticeHours)
  const now = new Date();
  const noticeThreshold = new Date(now.getTime() + rule.minNoticeHours * 60 * 60 * 1000);

  // Fetch database inputs together; Google events are fetched after calendar config resolves.
  const [calendarSources, dbAppointments] = await Promise.all([
    prisma.calendarSource.findMany({
      where: calendarSourceId ? { id: calendarSourceId, isBookingTarget: true } : undefined,
      select: {
        id: true,
        googleCalendarId: true,
        displayName: true,
        color: true,
        showTitle: true,
        showDescription: true,
        isBookingTarget: true,
      },
    }),
    prisma.appointmentRequest.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        startDatetime: { lte: endOfDay },
        endDatetime: { gte: startOfDay },
      },
      select: { startDatetime: true, endDatetime: true },
    }),
  ]);
  const calConfigs: CalendarSourceConfig[] = calendarSources.map((c) => ({
    id: c.id,
    googleCalendarId: c.googleCalendarId,
    displayName: c.displayName,
    color: c.color,
    showTitle: c.showTitle,
    showDescription: c.showDescription,
    isBookingTarget: c.isBookingTarget,
  }));

  const googleEvents = await fetchMergedEvents(calConfigs, startOfDay, endOfDay, timeZone);

  // 9. Generate candidate time slots within work hours
  const [startHour, startMin] = rule.workStartTime.split(':').map(Number);
  const [endHour, endMin] = rule.workEndTime.split(':').map(Number);

  const workStartMinutes = startHour * 60 + startMin;
  const workEndMinutes = endHour * 60 + endMin;

  const candidateSlots: TimeSlot[] = [];

  for (let current = workStartMinutes; current + slotDuration <= workEndMinutes; current += slotDuration) {
    const sHour = Math.floor(current / 60).toString().padStart(2, '0');
    const sMin = (current % 60).toString().padStart(2, '0');
    const eHour = Math.floor((current + slotDuration) / 60).toString().padStart(2, '0');
    const eMin = ((current + slotDuration) % 60).toString().padStart(2, '0');

    const slotStartIso = `${dateStr}T${sHour}:${sMin}:00`;
    const slotEndIso = `${dateStr}T${eHour}:${eMin}:00`;

    const slotStartDate = fromZonedTime(slotStartIso, timeZone);
    const slotEndDate = fromZonedTime(slotEndIso, timeZone);

    let available = true;
    let reason: string | undefined = undefined;

    // Check notice threshold
    if (slotStartDate < noticeThreshold) {
      available = false;
      reason = `Membutuhkan minimal notice ${rule.minNoticeHours} jam`;
    }

    // Check overlap with Google Calendar events
    if (available) {
      for (const gEvent of googleEvents) {
        const gStart = new Date(gEvent.start).getTime();
        const gEnd = new Date(gEvent.end).getTime();
        const sStart = slotStartDate.getTime();
        const sEnd = slotEndDate.getTime();

        // Overlap condition: slotStart < gEnd && slotEnd > gStart
        if (sStart < gEnd && sEnd > gStart) {
          available = false;
          reason = 'Bentrok dengan jadwal kalender';
          break;
        }
      }
    }

    // Check overlap with DB Appointment Requests
    if (available) {
      for (const dbApp of dbAppointments) {
        const dbStart = new Date(dbApp.startDatetime).getTime();
        const dbEnd = new Date(dbApp.endDatetime).getTime();
        const sStart = slotStartDate.getTime();
        const sEnd = slotEndDate.getTime();

        if (sStart < dbEnd && sEnd > dbStart) {
          available = false;
          reason = 'Sudah ada permintaan janji temu di jam ini';
          break;
        }
      }
    }

    candidateSlots.push({
      startTime: slotStartDate.toISOString(),
      endTime: slotEndDate.toISOString(),
      formattedStart: `${sHour}:${sMin}`,
      formattedEnd: `${eHour}:${eMin}`,
      available,
      reason,
    });
  }

  return {
    dateStr,
    isWorkday: true,
    isHoliday: false,
    slots: candidateSlots,
  };
}
