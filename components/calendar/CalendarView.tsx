'use client';

import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg } from '@fullcalendar/core';
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
  const [selectedEvent, setSelectedEvent] = useState<EventClickArg['event'] | null>(null);
  const [publicCalendars, setPublicCalendars] = useState<Array<{ id: string; displayName: string; color: string; showOnPublic: boolean }>>([]);
  useEffect(() => {
    const handleResize = () => {
      const calendar = calendarRef.current?.getApi();
      if (!calendar) return;

      const isMobile = window.innerWidth < 768;
      calendar.changeView(isMobile ? 'timeGridDay' : 'timeGridWeek');
      calendar.setOption('slotMinTime', '00:00:00');
      calendar.setOption('slotMaxTime', '24:00:00');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch('/api/public-calendars')
      .then((response) => response.json())
      .then((body) => setPublicCalendars(body.data || []))
      .catch(() => setPublicCalendars([]));
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

  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    setSelectedEvent(arg.event);
  };

  const formatEventTime = (date: Date | null) => date
    ? new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
    : null;

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
        {publicCalendars.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-1 pb-3" aria-label="Kalender aktif">
            {publicCalendars.filter((calendar) => calendar.showOnPublic).map((calendar) => (
              <span key={calendar.id} className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden="true" />
                {calendar.displayName}
              </span>
            ))}
          </div>
        )}
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
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={true}
          displayEventEnd={true}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          selectable={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          nowIndicator={true}
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

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#081637]/55 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="glass-panel-strong w-full max-w-md rounded-2xl p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Detail event</p>
                <h3 id="event-detail-title" className="mt-1 text-xl font-bold text-foreground">
                  {selectedEvent.title || 'Tanpa judul'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg px-2 py-1 text-lg font-bold text-muted transition hover:bg-surface-muted hover:text-foreground"
                aria-label="Tutup detail event"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 pt-4 text-sm text-foreground">
              <div className="rounded-xl bg-surface-muted/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Waktu WIB</p>
                <p className="mt-1 font-semibold">
                  {formatEventTime(selectedEvent.start)}
                  {selectedEvent.end ? ` – ${formatEventTime(selectedEvent.end)}` : ''}
                </p>
              </div>
              {selectedEvent.extendedProps?.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Deskripsi</p>
                  <p className="mt-1 whitespace-pre-wrap">{selectedEvent.extendedProps.description}</p>
                </div>
              )}
              {selectedEvent.extendedProps?.calendarName && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Kalender</p>
                  <p className="mt-1">{selectedEvent.extendedProps.calendarName}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Request Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        selectedDate={selectedDate}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
