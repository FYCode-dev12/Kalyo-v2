'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl border border-border flex flex-col max-h-[90vh]">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('terms.title')}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-4 text-sm text-foreground/80 pr-2 border-y border-border py-4 my-2">
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {t('terms.section1Title')}
            </h3>
            <p>{t('terms.section1Desc')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {t('terms.section2Title')}
            </h3>
            <p>{t('terms.section2Desc')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {t('terms.section3Title')}
            </h3>
            <p>{t('terms.section3Desc')}</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {t('terms.section4Title')}
            </h3>
            <p>{t('terms.section4Desc')}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg border border-border"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-xs transition-colors"
          >
            {t('terms.acceptButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
