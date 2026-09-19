import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { AppointmentRequestsPanel } from '@/components/dashboard/AppointmentRequestsPanel';

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">KALYO Admin</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          </div>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-100">
              Keluar
            </button>
          </form>
        </header>

        <AppointmentRequestsPanel />
      </div>
    </main>
  );
}
