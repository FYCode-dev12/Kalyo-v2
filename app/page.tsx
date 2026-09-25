'use client';

import React, { useState } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import dynamic from 'next/dynamic';

const CalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then((module) => module.CalendarView),
  {
    loading: () => (
      <div className="glass-panel-strong flex min-h-0 flex-1 items-center justify-center rounded-2xl text-sm text-muted">
        Memuat kalender…
      </div>
    ),
  }
);
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
    <div className="flex h-screen flex-col overflow-hidden">
      <HeaderContent onOpenTracker={() => setIsTrackerOpen(true)} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 md:px-8">
        <CalendarView />
      </main>

      <footer className="glass-panel shrink-0 border-b-0 border-x-0 px-4 py-2.5 text-center text-xs text-muted">
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
