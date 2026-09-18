export interface UnifiedEvent {
  id: string;
  title: string;
  description?: string | null;
  start: string; // ISO string with timezone or YYYY-MM-DD
  end: string;
  allDay: boolean;
  calendarId: string;
  calendarName: string;
  color: string;
  isMasked: boolean;
  rawGoogleId?: string;
}

export interface CalendarSourceConfig {
  id: string;
  googleCalendarId: string;
  displayName: string;
  color: string;
  showTitle: boolean;
  showDescription: boolean;
  isBookingTarget: boolean;
}

export interface CreateEventParams {
  calendarId: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
}
