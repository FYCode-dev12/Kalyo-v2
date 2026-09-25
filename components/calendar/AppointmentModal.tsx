'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appointmentRequestSchema, type AppointmentRequestInput } from '@/lib/validations/appointment';
import { useI18n } from '@/lib/i18n';
import { TermsModal } from '@/components/terms/TermsModal';

interface AppointmentModalProps {
  isOpen: boolean;
  selectedDate: string | null;
  onClose: () => void;
}

type CalendarOption = { id: string; displayName: string; color: string; isBookingTarget: boolean };
type SlotState = { available: boolean; reason?: string };

export function AppointmentModal({ isOpen, selectedDate, onClose }: AppointmentModalProps) {
  const { t } = useI18n();
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [slotState, setSlotState] = useState<SlotState | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ id: string; statusToken: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppointmentRequestInput>({
    resolver: zodResolver(appointmentRequestSchema),
    defaultValues: { termsAccepted: false },
  });

  const startDatetime = watch('startDatetime');
  const endDatetime = watch('endDatetime');
  const calendarSourceId = watch('calendarSourceId');

  const toIso = (value: string) => new Date(value).toISOString();

  const fetchCalendars = useCallback(async () => {
    const response = await fetch('/api/public-calendars');
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t('common.error'));
    const targets = (body.data || []).filter((calendar: CalendarOption) => calendar.isBookingTarget);
    setCalendars(targets);
    if (targets[0]) setValue('calendarSourceId', targets[0].id, { shouldValidate: true });
  }, [setValue, t]);

  const validateTimeRange = useCallback(async () => {
    if (!startDatetime || !endDatetime) {
      setSlotState(null);
      return;
    }
    setLoading(true);
    try {
      const date = startDatetime.slice(0, 10);
      const response = await fetch(`/api/availability?date=${date}&calendarSourceId=${encodeURIComponent(calendarSourceId || '')}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('common.error'));
      const slot = body.data.slots?.find((item: { startTime: string; endTime: string }) =>
        item.startTime === toIso(startDatetime) && item.endTime === toIso(endDatetime)
      );
      setSlotState(slot || { available: false, reason: 'Waktu mulai dan selesai harus mengikuti durasi slot yang tersedia.' });
    } catch (error) {
      setSlotState({ available: false, reason: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setLoading(false);
    }
  }, [startDatetime, endDatetime, calendarSourceId, t]);

  useEffect(() => {
    if (!isOpen) return;
    // Initial modal synchronization intentionally loads remote public settings.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCalendars().catch((error) => setSubmitError(error.message));
    reset({
      termsAccepted: false,
      calendarSourceId: '',
      startDatetime: selectedDate ? `${selectedDate}T09:00` : '',
      endDatetime: selectedDate ? `${selectedDate}T09:30` : '',
    });
    setTermsAccepted(false);
    setSuccessData(null);
    setSubmitError(null);
    setSlotState(null);
  }, [isOpen, selectedDate, fetchCalendars, reset]);

  useEffect(() => {
    if (isOpen && startDatetime && endDatetime) validateTimeRange();
  }, [isOpen, startDatetime, endDatetime, validateTimeRange]);

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setValue('termsAccepted', true, { shouldValidate: true });
  };

  const onSubmit = async (data: AppointmentRequestInput) => {
    if (!slotState?.available || !calendarSourceId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch('/api/appointment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDatetime: toIso(data.startDatetime),
          endDatetime: toIso(data.endDatetime),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('common.error'));
      setSuccessData(body.data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#081637]/55 p-2 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="glass-panel-strong flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl p-4 shadow-2xl sm:max-h-[90vh] sm:p-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{t('form.title')}</h2>
              <p className="mt-0.5 text-xs text-muted">{selectedDate ? `${t('calendar.today')}: ${selectedDate}` : t('form.subtitle')}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-lg font-bold text-muted hover:text-foreground" aria-label="Tutup">✕</button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto py-4">
            {successData ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <div className="text-3xl text-emerald-600">✓</div>
                <h3 className="text-lg font-bold text-emerald-900">{t('form.successTitle')}</h3>
                <p className="text-sm text-emerald-700">{t('form.successMessage')}</p>
                <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-xs font-mono select-all">{successData.statusToken}</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-3 border-b border-border pb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">Jenis kalender</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {calendars.map((calendar) => (
                      <label key={calendar.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${calendarSourceId === calendar.id ? 'border-brand bg-brand/10' : 'border-border bg-surface'}`}>
                        <input type="radio" value={calendar.id} {...register('calendarSourceId')} />
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} />
                        <span>{calendar.displayName}</span>
                      </label>
                    ))}
                  </div>
                  {errors.calendarSourceId && <p className="text-xs text-rose-500">Pilih kalender tujuan.</p>}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-foreground">Waktu mulai<input type="datetime-local" step="1800" {...register('startDatetime')} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-foreground">Waktu selesai<input type="datetime-local" step="1800" {...register('endDatetime')} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                </div>
                {loading && <p className="text-xs text-muted">Memeriksa ketersediaan waktu...</p>}
                {slotState && <p className={`rounded-lg p-3 text-xs font-medium ${slotState.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{slotState.available ? 'Waktu tersedia.' : slotState.reason}</p>}
                {errors.startDatetime && <p className="text-xs text-rose-500">{errors.startDatetime.message}</p>}
                {errors.endDatetime && <p className="text-xs text-rose-500">{errors.endDatetime.message}</p>}

                <div className="space-y-3 border-t border-border pt-4">
                  <label className="block text-xs font-medium text-foreground">{t('form.name')} *<input type="text" {...register('requesterName')} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-medium text-foreground">{t('form.email')} *<input type="email" {...register('requesterEmail')} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-medium text-foreground">{t('form.phone')}<input type="tel" {...register('requesterPhone')} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-medium text-foreground">{t('form.purpose')}<textarea rows={2} {...register('purpose')} className="mt-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsAccepted(event.target.checked); setValue('termsAccepted', event.target.checked, { shouldValidate: true }); }} className="mt-0.5 h-4 w-4 rounded border-border text-brand" />
                    <span className="text-xs leading-snug text-foreground/80">{t('form.agreeTerms')} <button type="button" onClick={() => setIsTermsOpen(true)} className="font-semibold text-brand hover:underline">({t('form.readTerms')})</button></span>
                  </div>
                  {errors.termsAccepted && <p className="mt-1 text-xs font-medium text-rose-500">{errors.termsAccepted.message}</p>}
                </div>

                {submitError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{submitError}</div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted">{t('common.cancel')}</button>
                  <button type="submit" disabled={isSubmitting || loading || !slotState?.available || !termsAccepted || !calendarSourceId} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-muted/50">{isSubmitting ? t('common.submitting') : t('form.submitRequest')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} onAccept={handleTermsAccept} />
    </>
  );
}
