'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type AppointmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type FilterStatus = 'ALL' | AppointmentStatus;

interface AppointmentRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  purpose: string | null;
  startDatetime: string;
  endDatetime: string;
  status: AppointmentStatus;
  statusToken: string;
  googleEventId: string | null;
  rejectReason: string | null;
  createdAt: string;
}

interface ApiResponse {
  data?: AppointmentRequest[];
  meta?: { page: number; pageSize: number; total: number; totalPages: number; counts: { ALL: number; PENDING: number; APPROVED: number; REJECTED: number } };
  error?: string;
}

interface ActionResult {
  status: 'APPROVED' | 'REJECTED';
  calendarSynced: boolean;
  emailSent: boolean;
}

const TIME_ZONE = 'Asia/Jakarta';

const statusStyles: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

const statusLabels: Record<AppointmentStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))} WIB`;
}

export function AppointmentRequestsPanel() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ApiResponse['meta']>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<Record<string, ActionResult>>({});
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [emailRetryResult, setEmailRetryResult] = useState<Record<string, boolean>>({});

  const loadRequests = useCallback(async (isRefresh = false) => {
    setError(null);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (filter !== 'ALL') params.set('status', filter);
      if (appliedSearch) params.set('q', appliedSearch);
      const response = await fetch(`/api/admin/appointment-requests?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(body.error || 'Gagal mengambil permintaan janji temu.');
      setRequests(body.data || []);
      setMeta(body.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil permintaan janji temu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedSearch, filter, page]);

  useEffect(() => {
    // Initial data load is an external API synchronization for this client panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = requests;

  function changeFilter(nextFilter: FilterStatus) {
    setFilter(nextFilter);
    setPage(1);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  }

  const counts = meta?.counts || { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };

  async function retryEmail(request: AppointmentRequest) {
    setActionError(null);
    setRetryingEmailId(request.id);
    try {
      const response = await fetch('/api/admin/appointment-requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id }),
      });
      const body = (await response.json()) as { error?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(body.error || 'Email belum berhasil dikirim.');
      setEmailRetryResult((current) => ({ ...current, [request.id]: body.emailSent === true }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Email belum berhasil dikirim.');
    } finally {
      setRetryingEmailId(null);
    }
  }

  async function updateStatus(request: AppointmentRequest, status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !rejectReasons[request.id]?.trim()) {
      setActionError('Tuliskan alasan penolakan sebelum menolak permintaan.');
      setExpandedId(request.id);
      return;
    }

    setActionError(null);
    setProcessingId(request.id);

    try {
      const response = await fetch('/api/admin/appointment-requests/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          status,
          rejectReason: status === 'REJECTED' ? rejectReasons[request.id].trim() : undefined,
        }),
      });
      const body = (await response.json()) as { error?: string; calendarSynced?: boolean; emailSent?: boolean };
      if (!response.ok) throw new Error(body.error || 'Gagal memperbarui status.');

      setLastAction((current) => ({
        ...current,
        [request.id]: {
          status,
          calendarSynced: body.calendarSynced === true,
          emailSent: body.emailSent === true,
        },
      }));
      await loadRequests(true);
      setExpandedId(request.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="admin-requests space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Appointment management</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Permintaan Janji Temu</h2>
          <p className="mt-1 text-sm text-slate-500">Semua waktu ditampilkan dalam zona waktu Asia/Jakarta (WIB).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/analytics" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
            Analytics
          </a>
          <form onSubmit={submitSearch} className="flex gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, keperluan" className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500" />
            <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cari</button>
          </form>
          <button type="button" onClick={() => void loadRequests(true)} disabled={refreshing} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
            {refreshing ? 'Memuat...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
          <button key={status} type="button" onClick={() => changeFilter(status)} className={`rounded-xl border p-4 text-left transition ${filter === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
            <span className="block text-xs font-semibold uppercase tracking-wide opacity-70">{status === 'ALL' ? 'Semua' : statusLabels[status]}</span>
            <span className="mt-1 block text-2xl font-bold">{counts[status]}</span>
          </button>
        ))}
      </div>

      {(error || actionError) && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error || actionError}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Memuat permintaan...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-slate-800">Tidak ada permintaan</p>
          <p className="mt-1 text-sm text-slate-500">Belum ada data pada filter yang dipilih.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const expanded = expandedId === request.id;
            const processing = processingId === request.id;
            return (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button type="button" onClick={() => setExpandedId(expanded ? null : request.id)} className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{request.requesterName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[request.status]}`}>{statusLabels[request.status]}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{request.requesterEmail}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{formatDateRange(request.startDatetime, request.endDatetime)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-slate-500">{expanded ? 'Tutup detail ↑' : 'Lihat detail ↓'}</span>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                    {lastAction[request.id] && (
                      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                        <p className="font-semibold">Status berhasil diperbarui menjadi {statusLabels[lastAction[request.id].status]}.</p>
                        <p className="mt-1">Google Calendar: {lastAction[request.id].calendarSynced ? 'event berhasil dibuat' : 'belum tersinkron (periksa konfigurasi/izin calendar)'}</p>
                        <p>Email: {lastAction[request.id].emailSent ? 'berhasil dikirim' : 'belum terkirim (periksa konfigurasi SMTP)'}</p>
                      </div>
                    )}
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                      <div><dt className="font-semibold text-slate-500">Telepon</dt><dd className="mt-1 text-slate-900">{request.requesterPhone || '—'}</dd></div>
                      <div><dt className="font-semibold text-slate-500">Diajukan</dt><dd className="mt-1 text-slate-900">{formatDateTime(request.createdAt)} WIB</dd></div>
                      <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Keperluan</dt><dd className="mt-1 whitespace-pre-wrap text-slate-900">{request.purpose || '—'}</dd></div>
                      {request.rejectReason && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Alasan penolakan</dt><dd className="mt-1 whitespace-pre-wrap text-rose-700">{request.rejectReason}</dd></div>}
                      {request.googleEventId && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Google Event ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{request.googleEventId}</dd></div>}
                    </dl>
                    {request.status !== 'PENDING' && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                        <button type="button" onClick={() => void retryEmail(request)} disabled={retryingEmailId === request.id} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                          {retryingEmailId === request.id ? 'Mengirim...' : 'Kirim ulang email'}
                        </button>
                        {emailRetryResult[request.id] && <span className="text-sm font-medium text-emerald-700">Email berhasil dikirim ulang.</span>}
                      </div>
                    )}

                    {request.status === 'PENDING' && (
                      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor={`reject-${request.id}`}>Alasan penolakan (wajib jika menolak)</label>
                        <textarea id={`reject-${request.id}`} value={rejectReasons[request.id] || ''} onChange={(event) => setRejectReasons((current) => ({ ...current, [request.id]: event.target.value }))} rows={2} placeholder="Contoh: Ada agenda lain pada waktu tersebut." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => void updateStatus(request, 'REJECTED')} disabled={processing} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">{processing ? 'Memproses...' : 'Tolak'}</button>
                          <button type="button" onClick={() => void updateStatus(request, 'APPROVED')} disabled={processing} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{processing ? 'Memproses...' : 'Setujui'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-slate-500">Halaman {meta.page} dari {meta.totalPages} · {meta.total} hasil</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
            <button type="button" disabled={page >= meta.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      )}
    </section>
  );
}
