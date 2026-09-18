'use client';

import React, { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useI18n } from '@/lib/i18n';
import { AppointmentModal } from '@/components/calendar/AppointmentModal';

export function CalendarView() {
  const { locale, t } = useI18n();
  const calendarRef = useRef<FullCalendar>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Handle date click on calendar
  const handleDateClick = (arg: { dateStr: string }) => {
    // Extract YYYY-MM-DD
    const dateOnly = arg.dateStr.split('T')[0];
    setSelectedDate(dateOnly);
    setIsModalOpen(true);
  };

  const handleOpenAppointmentModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Calendar Top Action Header */}
      <div className="flex items-center justify-between bg-surface p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {t('calendar.title')}
          </h2>
          <p className="text-xs text-muted">
            Timezone: Asia/Jakarta (WIB)
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAppointmentModal}
          className="px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-dark rounded-xl shadow-xs transition-all flex items-center gap-1.5"
        >
          <span>+</span>
          <span>{t('calendar.requestAppointment')}</span>
        </button>
      </div>

      {/* FullCalendar Wrapper */}
      <div className="w-full bg-surface p-4 rounded-2xl border border-border shadow-2xs overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          timeZone="Asia/Jakarta"
          locale={locale === 'id' ? 'id' : 'en'}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month'),
            week: t('calendar.week'),
            day: t('calendar.day'),
          }}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={true}
          selectable={true}
          dateClick={handleDateClick}
          events={async (fetchInfo, successCallback, failureCallback) => {
            try {
              const res = await fetch(
                `/api/events?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
              );
              const json = await res.json();
              if (!res.ok) throw new Error(json.error);

              const formattedEvents = (json.data || []).map((item: {
                id: string;
                title: string;
                start: string;
                end: string;
                color: string;
                allDay: boolean;
              }) => ({
                id: item.id,
                title: item.title,
                start: item.start,
                end: item.end,
                backgroundColor: item.color,
                borderColor: item.color,
                allDay: item.allDay,
              }));

              successCallback(formattedEvents);
            } catch (err) {
              console.error('[CalendarView] Fetch events error:', err);
              failureCallback(err as Error);
            }
          }}
          height="auto"
          expandRows={true}
        />
      </div>

      {/* Appointment Request Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        selectedDate={selectedDate}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
