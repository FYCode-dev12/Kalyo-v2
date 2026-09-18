'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center rounded-lg bg-surface-muted p-1 border border-border">
      <button
        type="button"
        onClick={() => setLocale('id')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
          locale === 'id'
            ? 'bg-surface text-foreground shadow-xs'
            : 'text-muted hover:text-foreground'
        }`}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
          locale === 'en'
            ? 'bg-surface text-foreground shadow-xs'
            : 'text-muted hover:text-foreground'
        }`}
      >
        EN
      </button>
    </div>
  );
}
