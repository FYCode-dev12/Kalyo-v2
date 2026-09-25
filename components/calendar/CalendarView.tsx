'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  useEffect(() => {
    const handleResize = () => {
      const calendar = calendarRef.current?.getApi();
      if (!calendar) return;

      const isMobile = window.innerWidth < 768;
      calendar.changeView(isMobile ? 'timeGridDay' : 'timeGridWeek');
      calendar.setOption('slotMinTime', isMobile ? '00:00:00' : '08:00:00');
      calendar.setOption('slotMaxTime', isMobile ? '24:00:00' : '20:00:00');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div className="flex h-full w-full flex-1 flex-col gap-3 overflow-hidden">
      {/* Calendar Top Action Header */}
      <div className="glass-panel flex shrink-0 items-center justify-between gap-4 rounded-2xl px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#06b6d4] shadow-[0_0_0_4px_rgb(6_182_212_/_0.15)]" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Availability</span>
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">{t('calendar.title')}</h2>
        </div>
        <button type="button" onClick={handleOpenAppointmentModal} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-md">
          <span className="text-lg leading-none">+</span>
          <span>{t('calendar.requestAppointment')}</span>
        </button>
      </div>

      {/* FullCalendar Wrapper - Internal Scroll */}
      <div className="glass-panel-strong w-full flex-1 overflow-hidden rounded-2xl p-3 sm:p-4">
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
          eventSources={[
            {
              events: async (fetchInfo, successCallback, failureCallback) => {
                try {
                  const response = await fetch(
                    `/api/events?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
                  );
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  successCallback(json.data || []);
                } catch (err) {
                  console.error('[CalendarView] Fetch appointment events error:', err);
                  failureCallback(err as Error);
                }
              },
            },
            {
              events: async (fetchInfo, successCallback, failureCallback) => {
                try {
                  const response = await fetch(
                    `/api/google-events?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
                  );
                  const json = await response.json();
                  if (!response.ok) throw new Error(json.error);
                  successCallback(json.data || []);
                } catch (err) {
                  console.warn('[CalendarView] Google events unavailable:', err);
                  failureCallback(err as Error);
                }
              },
            },
          ]}
          height="100%"
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
