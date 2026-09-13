export type AdminVerdict = 'VERIFIED' | 'BLOCKED' | 'UNAVAILABLE';

export type AdminCapability =
  | 'system.read'
  | 'truth.read'
  | 'contracts.read'
  | 'operations.read'
  | 'security.read'
  | 'changes.read'
  | 'audit.read'
  | 'production.write';

export type EvidenceRecord = {
  id: string;
  claim: string;
  sha: string;
  source: string;
  capturedAt: string;
  verdict: AdminVerdict;
};

export type ControlPlaneState = {
  connected: boolean;
  verdict: AdminVerdict;
  reason: string;
  capabilities: readonly AdminCapability[];
  evidence: readonly EvidenceRecord[];
};

export const ADMIN_CAPABILITIES: readonly AdminCapability[] = [
  'system.read',
  'truth.read',
  'contracts.read',
  'operations.read',
  'security.read',
  'changes.read',
  'audit.read',
  'production.write',
] as const;

/**
 * Production-safe default: the control plane is unavailable until a server-side
 * identity, policy and evidence boundary is connected. This deliberately avoids
 * pretending that client-side state is an authenticated Admin session.
 */
export const INITIAL_CONTROL_PLANE_STATE: ControlPlaneState = {
  connected: false,
  verdict: 'UNAVAILABLE',
  reason: 'server_auth_boundary_not_connected',
  capabilities: ADMIN_CAPABILITIES,
  evidence: [],
};
