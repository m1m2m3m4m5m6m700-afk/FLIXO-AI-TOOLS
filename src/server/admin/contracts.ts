import type { AdminCapability } from '../../lib/admin/control-plane.ts';
import type { AdminRole } from '../../lib/admin/roles.ts';

export interface AdminSession {
  subject: string;
  sessionId?: string;
  capabilities: Set<AdminCapability>;
  role?: AdminRole;
  expiresAt: number;
}
