'use client';

import React, { useState } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CalendarView } from '@/components/calendar/CalendarView';
import { StatusTrackerModal } from '@/components/calendar/StatusTrackerModal';

function HeaderContent({ onOpenTracker }: { onOpenTracker: () => void }) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border py-3 px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand flex items-center justify-center text-white font-black text-lg shadow-xs">
          K
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground leading-tight">
            {t('common.title')}
          </h1>
          <p className="text-xs text-muted leading-none">
            {t('common.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenTracker}
          className="text-xs font-semibold text-foreground/80 hover:text-brand px-3 py-1.5 rounded-lg border border-border hover:border-brand/40 transition-all bg-surface"
        >
          Lacak Status
        </button>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

function MainApp() {
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <HeaderContent onOpenTracker={() => setIsTrackerOpen(true)} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <CalendarView />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted bg-surface">
        <p>© 2026 KALYO Personal Scheduling Engine. All rights reserved.</p>
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
