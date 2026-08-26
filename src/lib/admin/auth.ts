export type AdminRole = 'owner' | 'admin' | 'analyst';

export interface AdminSessionStatus {
  authenticated: boolean;
  role: AdminRole | null;
}

export interface AdminLoginResult {
  ok: boolean;
  role?: AdminRole;
  error?: string;
}

/**
 * Browser-safe facade for the Vite SPA.
 * Real administrator authentication is server-only and must not be bundled
 * into the client application.
 */
export async function getAdminSessionStatus(): Promise<AdminSessionStatus> {
  return { authenticated: false, role: null };
}

export async function loginAdmin(_input: { data: { password: string } }): Promise<AdminLoginResult> {
  return {
    ok: false,
    error: 'Administrator authentication requires the server runtime.',
  };
}

export async function logoutAdmin(): Promise<{ ok: true }> {
  return { ok: true };
}
