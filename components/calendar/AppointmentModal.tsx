'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appointmentRequestSchema, type AppointmentRequestInput } from '@/lib/validations/appointment';
import { useI18n } from '@/lib/i18n';
import { TermsModal } from '@/components/terms/TermsModal';
import type { TimeSlot } from '@/types/availability';

interface AppointmentModalProps {
  isOpen: boolean;
  selectedDate: string | null; // YYYY-MM-DD
  onClose: () => void;
}

export function AppointmentModal({ isOpen, selectedDate, onClose }: AppointmentModalProps) {
  const { t } = useI18n();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [isTermsOpen, setIsTermsOpen] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ id: string; statusToken: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AppointmentRequestInput>({
    resolver: zodResolver(appointmentRequestSchema),
    defaultValues: {
      termsAccepted: false,
    },
  });

  // Fetch available slots when selectedDate changes
  const fetchSlots = useCallback(async (dateStr: string) => {
    setLoadingSlots(true);
    setSlotError(null);
    setSlots([]);
    setSelectedSlot(null);

    try {
      const res = await fetch(`/api/availability?date=${dateStr}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || t('common.error'));
      }

      const data = json.data;
      if (data.isHoliday) {
        setSlotError(`${t('calendar.holiday')}: ${data.holidayReason || ''}`);
      } else if (!data.isWorkday) {
        setSlotError(t('calendar.nonWorkday'));
      } else {
        setSlots(data.slots || []);
      }
    } catch (err: unknown) {
      setSlotError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoadingSlots(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchSlots(selectedDate);
      reset();
      setTermsAccepted(false);
      setSuccessData(null);
      setSubmitError(null);
    }
  }, [isOpen, selectedDate, fetchSlots, reset]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setValue('startDatetime', slot.startTime, { shouldValidate: true });
    setValue('endDatetime', slot.endTime, { shouldValidate: true });
  };

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setValue('termsAccepted', true, { shouldValidate: true });
  };

  const onSubmit = async (data: AppointmentRequestInput) => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/appointment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || t('common.error'));
      }

      setSuccessData(json.data);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
        <div className="w-full max-w-xl rounded-2xl bg-surface p-6 shadow-xl border border-border max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {t('form.title')}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {selectedDate ? `${t('calendar.today')}: ${selectedDate}` : t('form.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-foreground text-lg font-bold p-1 rounded-md"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {successData ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3">
                <div className="text-emerald-600 text-3xl">✓</div>
                <h3 className="text-lg font-bold text-emerald-900">
                  {t('form.successTitle')}
                </h3>
                <p className="text-sm text-emerald-700">
                  {t('form.successMessage')}
                </p>
                <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200 text-xs font-mono select-all break-all">
                  <span className="font-sans font-medium text-muted block mb-1">
                    {t('form.statusTokenText')}
                  </span>
                  <strong className="text-emerald-800 text-sm">{successData.statusToken}</strong>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* 1. Time Slot Selection */}
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    {t('calendar.selectSlot')}
                  </label>

                  {loadingSlots ? (
                    <div className="py-6 text-center text-xs text-muted">
                      {t('common.loading')}
                    </div>
                  ) : slotError ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium">
                      {slotError}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="p-3 bg-surface-muted text-muted rounded-lg text-xs text-center">
                      {t('calendar.noAvailableSlots')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border border-border rounded-xl">
                      {slots.map((slot, idx) => {
                        const isSelected = selectedSlot?.startTime === slot.startTime;
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => handleSlotSelect(slot)}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                              !slot.available
                                ? 'bg-surface-muted text-muted/50 border-transparent cursor-not-allowed line-through'
                                : isSelected
                                ? 'bg-brand text-white border-brand shadow-xs'
                                : 'bg-surface text-foreground border-border hover:border-brand/50'
                            }`}
                            title={slot.reason}
                          >
                            {slot.formattedStart} - {slot.formattedEnd}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.startDatetime && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">
                      Pilih salah satu slot waktu di atas.
                    </p>
                  )}
                </div>

                {/* 2. Requester Details */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t('form.name')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t('form.namePlaceholder')}
                      {...register('requesterName')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    {errors.requesterName && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">
                        {errors.requesterName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t('form.email')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder={t('form.emailPlaceholder')}
                      {...register('requesterEmail')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    {errors.requesterEmail && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">
                        {errors.requesterEmail.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t('form.phone')}
                    </label>
                    <input
                      type="tel"
                      placeholder={t('form.phonePlaceholder')}
                      {...register('requesterPhone')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t('form.purpose')}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t('form.purposePlaceholder')}
                      {...register('purpose')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                    />
                  </div>
                </div>

                {/* 3. T&C Blocking Gate Checkbox */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="termsAccepted"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        setValue('termsAccepted', e.target.checked, { shouldValidate: true });
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    />
                    <label htmlFor="termsAccepted" className="text-xs text-foreground/80 leading-snug">
                      {t('form.agreeTerms')}{' '}
                      <button
                        type="button"
                        onClick={() => setIsTermsOpen(true)}
                        className="text-brand font-semibold hover:underline"
                      >
                        ({t('form.readTerms')})
                      </button>
                    </label>
                  </div>
                  {errors.termsAccepted && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">
                      {errors.termsAccepted.message}
                    </p>
                  )}
                </div>

                {submitError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                    {submitError}
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg border border-border"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedSlot || !termsAccepted}
                    className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-xs transition-colors ${
                      isSubmitting || !selectedSlot || !termsAccepted
                        ? 'bg-muted/50 cursor-not-allowed'
                        : 'bg-brand hover:bg-brand-dark'
                    }`}
                  >
                    {isSubmitting ? t('common.submitting') : t('form.submitRequest')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* T&C Modal */}
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        onAccept={handleTermsAccept}
      />
    </>
  );
}
