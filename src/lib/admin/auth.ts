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
 * Real administrator authentication is server-only and is intentionally
 * unavailable until the dedicated authentication backend is implemented.
 */
export async function getAdminSessionStatus(): Promise<AdminSessionStatus> {
  return { authenticated: false, role: null };
}

export async function loginAdmin(input: { data: { password: string } }): Promise<AdminLoginResult> {
  void input;
  return {
    ok: false,
    error: 'Administrator authentication is not available in the SPA build.',
  };
}

export async function logoutAdmin(): Promise<{ ok: true }> {
  return { ok: true };
}
