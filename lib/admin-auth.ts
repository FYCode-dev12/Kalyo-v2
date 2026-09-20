import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_JWT_SECRET wajib diatur dan minimal 32 karakter.');
  }
  return new TextEncoder().encode(secret);
}

export const ADMIN_GOOGLE_EMAIL = 'febrianyoel100@gmail.com';

export function getAllowedAdminEmails(): string[] {
  return [ADMIN_GOOGLE_EMAIL];
}

interface AdminSession {
  email: string;
  iat: number;
  exp: number;
}

export async function createAdminToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) return false;

  const session = await verifyAdminToken(token);
  if (!session) return false;

  return getAllowedAdminEmails().includes(session.email.toLowerCase());
}

export function adminProtectedRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authenticated = await isAdminAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(req);
  };
}
