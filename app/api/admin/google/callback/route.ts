import { cookies } from 'next/headers';
import { createAdminToken, getAllowedAdminEmails } from '@/lib/admin-auth';

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

function logOAuthFailure(stage: string, details: Record<string, string | number | undefined>) {
  console.error(`[Google OAuth] ${stage}`, details);
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
}

function redirectToLogin(request: Request, error: string) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', error);
  return Response.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');
  const oauthError = requestUrl.searchParams.get('error');
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (oauthError) return redirectToLogin(request, 'Login Google dibatalkan.');
  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    return redirectToLogin(request, 'Sesi OAuth tidak valid. Silakan coba lagi.');
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${requestUrl.origin}/api/auth/google/callback`;
  if (!clientId || !clientSecret) {
    logOAuthFailure('missing-config', { hasClientId: Number(Boolean(clientId)), hasClientSecret: Number(Boolean(clientSecret)) });
    return redirectToLogin(request, 'Google OAuth belum dikonfigurasi.');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenData.access_token) {
      logOAuthFailure('token-exchange', {
        status: tokenResponse.status,
        error: tokenData.error,
        description: tokenData.error_description,
        redirectUri,
      });
      return redirectToLogin(request, 'Token Google tidak dapat diverifikasi.');
    }

    const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = (await userResponse.json()) as GoogleUserInfo;
    const email = user.email?.trim().toLowerCase();

    if (!userResponse.ok || !email || !user.email_verified || !getAllowedAdminEmails().includes(email)) {
      return redirectToLogin(request, 'Akun Google ini tidak memiliki akses admin.');
    }

    const jwt = await createAdminToken(email);
    cookieStore.set('admin_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return Response.redirect(new URL('/admin', request.url));
  } catch {
    return redirectToLogin(request, 'Login Google gagal. Silakan coba lagi.');
  }
}
