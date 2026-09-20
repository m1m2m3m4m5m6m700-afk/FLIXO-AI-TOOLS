export type AdminModuleStatus = 'FOUNDATION' | 'PARTIAL' | 'BLOCKED';

export type AdminModule = {
  id: string;
  name: string;
  status: AdminModuleStatus;
  capability: string;
  truth: 'IMPLEMENTATION_PRESENT' | 'RUNTIME_UNAVAILABLE' | 'PROVENANCE_BLOCKED';
  blocker: string | null;
  execution: 'READ_ONLY' | 'LOCKED';
};

export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    id: 'command-center',
    name: 'Command Center',
    status: 'PARTIAL',
    capability: 'system.read',
    truth: 'RUNTIME_UNAVAILABLE',
    blocker: 'server-side production identity and command authorization are not connected',
    execution: 'LOCKED',
  },
  {
    id: 'truth-center',
    name: 'Truth Center',
    status: 'PARTIAL',
    capability: 'truth.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'live production truth is bounded to the canonical persistence/evidence read model',
    execution: 'READ_ONLY',
  },
  {
    id: 'security-center',
    name: 'Security Center',
    status: 'PARTIAL',
    capability: 'security.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'production identity/session policy is not proven end-to-end',
    execution: 'READ_ONLY',
  },
  {
    id: 'contract-center',
    name: 'Contract Center',
    status: 'PARTIAL',
    capability: 'contracts.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'live contract evidence adapter is not connected',
    execution: 'READ_ONLY',
  },
  {
    id: 'operations-center',
    name: 'Operations Center',
    status: 'PARTIAL',
    capability: 'operations.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'bounded persistence read model is available; broader live observability is not connected',
    execution: 'READ_ONLY',
  },
  {
    id: 'incident-center',
    name: 'Incident Center',
    status: 'PARTIAL',
    capability: 'operations.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'incident reads are bounded to the canonical persisted event source; alerting/triage is not connected',
    execution: 'READ_ONLY',
  },
  {
    id: 'change-center',
    name: 'Change Center',
    status: 'BLOCKED',
    capability: 'changes.read',
    truth: 'PROVENANCE_BLOCKED',
    blocker: 'deployment/change evidence adapter is not connected',
    execution: 'LOCKED',
  },
  {
    id: 'approval-center',
    name: 'Approval Center',
    status: 'BLOCKED',
    capability: 'production.write',
    truth: 'PROVENANCE_BLOCKED',
    blocker: 'approval persistence and production execution boundary are not connected',
    execution: 'LOCKED',
  },
  {
    id: 'evidence-ledger',
    name: 'Evidence Ledger',
    status: 'PARTIAL',
    capability: 'evidence.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'canonical evidence persistence read-back is available; broader evidence aggregation is not connected',
    execution: 'READ_ONLY',
  },
  {
    id: 'truth-graph',
    name: 'Truth Graph',
    status: 'PARTIAL',
    capability: 'truth.read',
    truth: 'IMPLEMENTATION_PRESENT',
    blocker: 'live evidence nodes are not connected',
    execution: 'READ_ONLY',
  },
] as const;

export const ADMIN_TRUTH_STATES = [
  'VERIFIED',
  'FAILED',
  'BLOCKED',
  'UNAVAILABLE',
  'STALE',
  'UNKNOWN',
] as const;

export type AdminTruthState = (typeof ADMIN_TRUTH_STATES)[number];

export const ADMIN_EXECUTION_CLASSES = [
  'READ',
  'LOW_RISK_WRITE',
  'HIGH_RISK_WRITE',
  'DESTRUCTIVE',
  'PRODUCTION_CHANGE',
] as const;

export const ADMIN_ROLE_CAPABILITY_MATRIX = {
  OWNER: ['system.read', 'truth.read', 'evidence.read', 'contracts.read', 'operations.read', 'security.read', 'changes.read', 'audit.read', 'production.write'],
  ADMIN: ['system.read', 'truth.read', 'evidence.read', 'contracts.read', 'operations.read', 'security.read', 'changes.read', 'audit.read', 'production.write'],
  OPERATOR: ['system.read', 'truth.read', 'evidence.read', 'contracts.read', 'operations.read', 'security.read', 'changes.read', 'audit.read'],
  ANALYST: ['system.read', 'truth.read', 'evidence.read', 'contracts.read', 'operations.read', 'security.read', 'changes.read', 'audit.read'],
  AUDITOR: ['system.read', 'truth.read', 'evidence.read', 'contracts.read', 'security.read', 'changes.read', 'audit.read'],
} as const;
