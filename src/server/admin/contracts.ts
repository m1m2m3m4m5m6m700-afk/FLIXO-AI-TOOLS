import type { AdminRole } from '../../lib/admin/roles.ts';

export interface AdminSession {
  subject: string;
  sessionId?: string;
  capabilities: Set<string>;
  role?: AdminRole;
  expiresAt: number;
}
