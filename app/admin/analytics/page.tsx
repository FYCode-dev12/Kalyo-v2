import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import AnalyticsClient from './AnalyticsClient';

// Server-side guard: without this the page returned 200 to anonymous visitors
// and shipped the admin shell plus the full recharts bundle before client-side
// 401 handling kicked in. Now unauthenticated requests redirect before render.
export default async function AdminAnalyticsPage() {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) redirect('/login');

  return <AnalyticsClient />;
}
