'use client';

import { useEffect, useState } from 'react';

type Rule = { workStartTime: string; workEndTime: string; workdays: number[]; minNoticeHours: number; slotDurationMin: number };
type Holiday = { id: string; date: string; reason: string | null };
type Calendar = { id: string; displayName: string; googleCalendarId: string; isBookingTarget: boolean };
const dayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function SettingsPage() {
  const [rule, setRule] = useState<Rule>({ workStartTime: '09:00', workEndTime: '17:00', workdays: [1, 2, 3, 4, 5], minNoticeHours: 24, slotDurationMin: 30 });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch('/api/admin/settings', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Gagal memuat pengaturan');
    if (body.data.businessRule) setRule(body.data.businessRule);
    setHolidays(body.data.holidays);
    setCalendars(body.data.calendars);
  }
  useEffect(() => {
    // Initial settings load synchronizes this client page with the admin API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  async function saveRule() {
    const response = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessRule: rule }) });
    const body = await response.json();
    setMessage(response.ok ? 'Aturan jadwal berhasil disimpan.' : body.error);
  }
  async function addHoliday() {
    const response = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, reason }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setHolidays((current) => [...current.filter((item) => item.id !== body.data.id), body.data].sort((a, b) => a.date.localeCompare(b.date)));
    setDate(''); setReason(''); setMessage('Holiday berhasil disimpan.');
  }
  async function removeHoliday(id: string) {
    const response = await fetch(`/api/admin/settings?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) { setHolidays((current) => current.filter((item) => item.id !== id)); setMessage('Holiday dihapus.'); }
  }
  if (loading) return <main className="p-8">Memuat pengaturan...</main>;
  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex items-center justify-between"><div><a href="/admin" className="text-sm text-slate-500 hover:underline">← Dashboard</a><h1 className="mt-2 text-3xl font-bold text-slate-900">Pengaturan Scheduling</h1></div><a href="/admin/analytics" className="rounded-lg border bg-white px-3 py-2 text-sm">Analytics</a></header>
    {message && <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">{message}</div>}
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Jam kerja & aturan slot</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Mulai<input type="time" value={rule.workStartTime} onChange={(e) => setRule({ ...rule, workStartTime: e.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Selesai<input type="time" value={rule.workEndTime} onChange={(e) => setRule({ ...rule, workEndTime: e.target.value })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Minimum notice (jam)<input type="number" min="1" value={rule.minNoticeHours} onChange={(e) => setRule({ ...rule, minNoticeHours: Number(e.target.value) })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Durasi slot (menit)<input type="number" min="1" value={rule.slotDurationMin} onChange={(e) => setRule({ ...rule, slotDurationMin: Number(e.target.value) })} className="mt-1 w-full rounded border p-2" /></label></div><div className="mt-4 flex flex-wrap gap-3">{dayLabels.map((label, day) => <label key={label} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.workdays.includes(day)} onChange={(e) => setRule({ ...rule, workdays: e.target.checked ? [...rule.workdays, day].sort() : rule.workdays.filter((item) => item !== day) })} />{label}</label>)}</div><button onClick={saveRule} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Simpan aturan</button></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Hari libur</h2><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border p-2" /><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" className="rounded border p-2" /><button onClick={addHoliday} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Tambah</button></div><div className="mt-4 divide-y">{holidays.map((holiday) => <div key={holiday.id} className="flex items-center justify-between py-3 text-sm"><span>{holiday.date.slice(0, 10)} — {holiday.reason || 'Hari libur'}</span><button onClick={() => removeHoliday(holiday.id)} className="text-rose-600 hover:underline">Hapus</button></div>)}</div></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Calendar sources</h2><p className="mt-1 text-sm text-slate-500">Sumber kalender yang digunakan untuk availability dan booking.</p><div className="mt-4 divide-y">{calendars.map((calendar) => <div key={calendar.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold">{calendar.displayName}{calendar.isBookingTarget && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Booking target</span>}</span><code className="break-all text-xs text-slate-500">{calendar.googleCalendarId}</code></div>)}</div></section>
  </div></main>;
}
