-- AlterTable
ALTER TABLE "CalendarSource" ADD COLUMN     "showOnPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppointmentRequest" ADD COLUMN     "calendarSourceId" TEXT;
