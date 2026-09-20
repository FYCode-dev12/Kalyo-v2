'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorMessage = new URLSearchParams(window.location.search).get('error');
    // OAuth callback error is external URL state synchronized into the form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (errorMessage) setError(errorMessage);
  }, []);


  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#172554,#2563eb)] text-sm font-black text-white shadow-lg shadow-blue-900/20">K/</div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-brand">KALYO Admin</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground">{t('login.title')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Masuk untuk mengelola permintaan janji temu dan jadwal Anda.</p>
        </div>

        <div className="glass-panel-strong rounded-2xl p-6 sm:p-8">
          {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">{error}</div>}
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-900">
              Gunakan akun Google administrator yang terdaftar untuk melanjutkan.
            </div>
            <a href="/api/admin/google/start" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-md">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"/><path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z"/><path fill="#FBBC05" d="M6.54 13.79A5.86 5.86 0 0 1 6.23 12c0-.62.11-1.23.31-1.79V7.68H3.3A9.75 9.75 0 0 0 2.26 12c0 1.57.38 3.05 1.04 4.32l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.18c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.27 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 7.9 9.46 6.18 12 6.18Z"/></svg>
              Masuk dengan Google
            </a>
            <p className="text-center text-xs leading-5 text-muted">Hanya akun Google yang telah diizinkan administrator yang dapat masuk.</p>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-muted">Akses terbatas untuk administrator KALYO.</p>
      </div>
    </main>
  );
}
