import type { AdminCapability } from './control-plane.ts';
import { ADMIN_CAPABILITIES, ADMIN_ROLE_CAPABILITY_MATRIX } from './module-registry.ts';

export type AdminRole = keyof typeof ADMIN_ROLE_CAPABILITY_MATRIX;

const ACTIVE_CAPABILITY_SET = new Set<string>(ADMIN_CAPABILITIES);

export const ADMIN_ROLES = Object.keys(ADMIN_ROLE_CAPABILITY_MATRIX) as AdminRole[];

export const capabilitiesForRole = (role: AdminRole): readonly AdminCapability[] => {
  const declared = ADMIN_ROLE_CAPABILITY_MATRIX[role] ?? [];
  return declared.filter((capability): capability is AdminCapability => ACTIVE_CAPABILITY_SET.has(capability));
};

export const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ADMIN_ROLE_CAPABILITY_MATRIX, value);

export const roleFromSubject = (subject: string): AdminRole => {
  if (subject === 'owner') return 'OWNER';
  return 'ADMIN';
};

export const activeCapabilitiesForRole = (role: AdminRole) =>
  [...new Set(['admin.read', ...capabilitiesForRole(role)])] as readonly AdminCapability[];
