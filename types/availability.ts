export interface TimeSlot {
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  formattedStart: string; // e.g. "09:00"
  formattedEnd: string;   // e.g. "09:30"
  available: boolean;
  reason?: string;
}

export interface AvailabilityParams {
  dateStr: string; // "YYYY-MM-DD"
  durationMin?: number; // default 30
  timeZone?: string; // default "Asia/Jakarta"
}
