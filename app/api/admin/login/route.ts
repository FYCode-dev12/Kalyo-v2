import { cookies } from 'next/headers';
import { createAdminToken } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const token = formData.get('token') as string;

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  const allowedTokens = (process.env.ADMIN_TOKENS || '').split(',');

  if (!email || !token) {
    return Response.json({ error: 'Email and token required' }, { status: 400 });
  }

  if (!adminEmails.includes(email.toLowerCase())) {
    return Response.json({ error: 'Unauthorized email' }, { status: 401 });
  }

  if (!allowedTokens.includes(token)) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const jwt = await createAdminToken(email);

  const cookieStore = await cookies();
  cookieStore.set('admin_session', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  redirect('/admin');
}
