import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminToken, isAdminAuthenticated } from '@/lib/admin-auth';

export default async function AdminPage() {
  const request = { cookies: async () => await cookies() } as any;
  const authenticated = await isAdminAuthenticated(request);

  if (!authenticated) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Admin Dashboard
        </h1>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-gray-700 mb-4">
              Admin session active
            </p>
            <p className="text-gray-700 mb-4">
              This is the protected admin area.
            </p>

            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="text-red-600 hover:text-red-800 underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
