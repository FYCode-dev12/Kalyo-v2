import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import SettingsPageClient from './SettingsPageClient';

// Server-side guard: without this the page returned 200 to anonymous visitors
// and shipped the admin shell + admin JS payload, relying only on a client-side
// 401 after load. Now unauthenticated requests are redirected before render.
export default async function SettingsPage() {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) redirect('/login');

  return <SettingsPageClient />;
}
