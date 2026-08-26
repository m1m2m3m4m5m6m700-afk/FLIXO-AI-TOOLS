import { useSession as createSession } from '@tanstack/react-start/server';

export type AdminRole = 'owner' | 'admin' | 'analyst';

export interface AdminSessionData {
  userId?: string;
  role?: AdminRole;
}

const SESSION_NAME = 'flixo-admin-session';

export function getAdminSession() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be configured with at least 32 characters.');
  }

  return createSession<AdminSessionData>({
    name: SESSION_NAME,
    password,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/admin',
      maxAge: 60 * 60 * 12,
    },
  });
}

export async function getCurrentAdmin() {
  const session = await getAdminSession();
  if (!session.data.userId || !session.data.role) return null;
  return { userId: session.data.userId, role: session.data.role };
}

export async function requireAdminRole(allowed: AdminRole[]) {
  const admin = await getCurrentAdmin();
  if (!admin || !allowed.includes(admin.role)) throw new Error('admin_unauthorized');
  return admin;
}
