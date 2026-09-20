'use client';

import React, { useState } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CalendarView } from '@/components/calendar/CalendarView';
import { StatusTrackerModal } from '@/components/calendar/StatusTrackerModal';

function HeaderContent({ onOpenTracker }: { onOpenTracker: () => void }) {
  const { t } = useI18n();

  return (
    <header className="glass-panel sticky top-0 z-30 rounded-b-2xl border-t-0 px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#172554,#2563eb)] text-sm font-black tracking-tight text-white shadow-lg shadow-blue-900/20">K/</div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-foreground">{t('common.title')}</h1>
            <p className="truncate text-xs leading-tight text-muted">{t('common.subtitle')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={onOpenTracker} className="rounded-lg px-3 py-2 text-xs font-semibold text-foreground/80 transition hover:bg-surface-muted hover:text-brand-dark">Lacak status</button>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function MainApp() {
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <HeaderContent onOpenTracker={() => setIsTrackerOpen(true)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-2 sm:mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Personal scheduling</p>
          <h2 className="max-w-2xl text-2xl font-bold tracking-[-0.035em] text-foreground sm:text-3xl">Atur waktu yang tepat untuk percakapan yang penting.</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">Pilih tanggal yang tersedia, tentukan slot waktu, lalu kirim permintaan janji temu. Semua waktu menggunakan WIB.</p>
        </div>
        <CalendarView />
      </main>

      <footer className="glass-panel mt-8 rounded-t-2xl border-b-0 border-x-0 px-4 py-6 text-center text-xs text-muted">
        <p>© 2026 KALYO · Personal Scheduling</p>
      </footer>

      <StatusTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <I18nProvider>
      <MainApp />
    </I18nProvider>
  );
}
