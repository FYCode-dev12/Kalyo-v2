'use client';

import React, { createContext, useContext, useState } from 'react';
import idMessages from '@/locales/id.json';
import enMessages from '@/locales/en.json';

type Locale = 'id' | 'en';

type Messages = typeof idMessages;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (keyPath: string) => string;
}

const messagesMap: Record<Locale, Messages> = {
  id: idMessages,
  en: enMessages,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'id';
    const saved = localStorage.getItem('kalyo_locale') as Locale;
    return saved === 'id' || saved === 'en' ? saved : 'id';
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('kalyo_locale', newLocale);
  };

  const t = (keyPath: string): string => {
    const keys = keyPath.split('.');
    let current: unknown = messagesMap[locale];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        // Fallback to key if translation missing
        return keyPath;
      }
    }

    return typeof current === 'string' ? current : keyPath;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
