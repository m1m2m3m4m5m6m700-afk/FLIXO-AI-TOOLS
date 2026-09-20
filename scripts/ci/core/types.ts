export const CI_CONTRACT_VERSION = 1 as const;

export type ContractStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_APPLICABLE';
export type CiMode = 'L0' | 'L1' | 'L2' | 'L3' | 'RELEASE';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ExecutionClass = 'static' | 'unit' | 'integration' | 'browser' | 'release';
export type RetryMode = 'never' | 'controlled';
export type FreshnessMode = 'commit' | 'dependency' | 'fresh';

export interface ContractScope {
  toolId?: string;
  route?: string;
  locale?: string;
  file?: string;
  artifact?: string;
}

export interface ContractEvidence {
  source?: string;
  line?: number;
  artifact?: string;
  sha256?: string;
}

export interface ContractResult {
  gate: string;
  contract: string;
  contractVersion: number;
  status: ContractStatus;
  severity: Severity;
  scope: ContractScope;
  assertion?: string;
  expected?: unknown;
  actual?: unknown;
  rootCauseId?: string;
  blockedBy?: string[];
  evidence?: ContractEvidence[];
  durationMs?: number;
}

export interface CiContract {
  id: string;
  version: number;
  gate: string;
  name: string;
  dependencies: string[];
  inputs: string[];
  outputs: string[];
  evaluator: string;
  scope: 'repository' | 'tool' | 'route' | 'locale' | 'artifact' | 'release';
  severity: Severity;
  execution: ExecutionClass;
  reusable: boolean;
  retry: RetryMode;
  freshness: FreshnessMode;
  escalation: { deep: boolean; full: boolean };
}

export interface CiExecutionContext {
  commitSha: string;
  baseSha: string;
  event: string;
  branch: string;
  repository: string;
  mode: CiMode;
  toolchainFingerprint: string;
  lockfileHash: string;
  contractHash: string;
  ciConfigHash: string;
  configHash: string;
  changedFiles: string[];
  affectedContracts: string[];
  affectedRoutes: string[];
  affectedLocales: string[];
  production: boolean;
  siteOrigin?: string;
}

export interface CiDecision {
  status: ContractStatus;
  requiredFailures: string[];
  requiredBlocked: string[];
  evaluated: number;
  reused: number;
  skipped: number;
}
