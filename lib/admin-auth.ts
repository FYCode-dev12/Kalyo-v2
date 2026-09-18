import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'admin-secret-change-me');

interface AdminSession {
  email: string;
  iat: number;
  exp: number;
}

export async function createAdminToken(email: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) return false;

  const session = await verifyAdminToken(token);
  if (!session) return false;

  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  return allowedEmails.includes(session.email.toLowerCase());
}

export function adminProtectedRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authenticated = await isAdminAuthenticated(req);

    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(req);
  };
}
