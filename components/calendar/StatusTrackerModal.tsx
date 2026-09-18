'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface StatusTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppointmentStatusData {
  id: string;
  requesterName: string;
  requesterEmail: string;
  purpose?: string | null;
  startDatetime: string;
  endDatetime: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
}

export function StatusTrackerModal({ isOpen, onClose }: StatusTrackerModalProps) {
  const { t } = useI18n();
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppointmentStatusData | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/appointment-requests/status?token=${encodeURIComponent(token.trim())}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || t('common.error'));
      }

      setResult(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl border border-border">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Lacak Status Janji Temu</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Masukkan Kode Pelacakan (Status Token)
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Contoh: uuid-token-anda"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full py-2 text-xs font-bold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-xs disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.loading') : 'Cari Status'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 rounded-xl border border-border bg-surface-muted space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted font-medium">Status:</span>
              <span
                className={`px-2 py-0.5 font-bold rounded-md uppercase text-[10px] ${
                  result.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : result.status === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {result.status}
              </span>
            </div>

            <div>
              <span className="text-muted font-medium block">Nama Pemohon:</span>
              <span className="font-semibold text-foreground">{result.requesterName}</span>
            </div>

            <div>
              <span className="text-muted font-medium block">Waktu Mulai:</span>
              <span className="font-mono text-foreground">
                {new Date(result.startDatetime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
              </span>
            </div>

            {result.rejectReason && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
                <span className="font-bold block">Alasan Penolakan:</span>
                <span>{result.rejectReason}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
