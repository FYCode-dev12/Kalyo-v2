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
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    setSelectedDate(today);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Calendar Top Action Header */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#06b6d4] shadow-[0_0_0_4px_rgb(6_182_212_/_0.15)]" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Availability</span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">{t('calendar.title')}</h2>
          <p className="mt-1 text-sm text-muted">Timezone: Asia/Jakarta (WIB)</p>
        </div>
        <button type="button" onClick={handleOpenAppointmentModal} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-md">
          <span className="text-lg leading-none">+</span>
          <span>{t('calendar.requestAppointment')}</span>
        </button>
      </div>

      {/* FullCalendar Wrapper */}
      <div className="glass-panel-strong w-full overflow-hidden rounded-2xl p-3 sm:p-5">
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
