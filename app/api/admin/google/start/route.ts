import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: 'Google OAuth belum dikonfigurasi.' }, { status: 503 });
  }

  const state = randomBytes(32).toString('hex');
  const requestUrl = new URL(request.url);
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${requestUrl.origin}/api/auth/google/callback`;
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('access_type', 'online');
  authorizationUrl.searchParams.set('prompt', 'select_account');

  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    // Callback URI is /api/auth/google/callback, so the state cookie must be site-wide.
    path: '/',
  });

  return Response.redirect(authorizationUrl);
}
