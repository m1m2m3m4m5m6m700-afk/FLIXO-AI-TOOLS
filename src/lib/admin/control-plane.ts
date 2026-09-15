export type AdminVerdict = 'VERIFIED' | 'BLOCKED' | 'UNAVAILABLE';

export type AdminCapability =
  | 'admin.read'
  | 'truth.read'
  | 'evidence.read'
  | 'security.read'
  | 'contracts.read'
  | 'operations.read'
  | 'incidents.manage'
  | 'changes.read'
  | 'approvals.review'
  | 'users.manage'
  | 'deployments.preview'
  | 'deployments.execute'
  | 'system.rollback'
  | 'system.read'
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

/**
 * Canonical capability vocabulary. Declaring a capability here never grants
 * runtime access; the server boundary and policy engine remain authoritative.
 */
export const ADMIN_CAPABILITIES: readonly AdminCapability[] = [
  'admin.read',
  'truth.read',
  'evidence.read',
  'security.read',
  'contracts.read',
  'operations.read',
  'incidents.manage',
  'changes.read',
  'approvals.review',
  'users.manage',
  'deployments.preview',
  'deployments.execute',
  'system.rollback',
  'system.read',
  'audit.read',
  'production.write',
] as const;

/**
 * Production mutation capabilities are declared but remain locked until their
 * server-side authorization, policy, evidence, and production proofs exist.
 */
export const ADMIN_LOCKED_MUTATION_CAPABILITIES: readonly AdminCapability[] = [
  'incidents.manage',
  'approvals.review',
  'users.manage',
  'deployments.preview',
  'deployments.execute',
  'system.rollback',
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
