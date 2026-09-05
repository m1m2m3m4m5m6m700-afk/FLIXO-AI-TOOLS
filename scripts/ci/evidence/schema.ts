export type EvidenceStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_APPLICABLE';

export interface EvidenceScope {
  toolId?: string;
  route?: string;
  locale?: string;
  file?: string;
  artifact?: string;
}

export interface EvidenceRecord {
  schemaVersion: 1;
  gate: string;
  contract: string;
  contractVersion: number;
  status: EvidenceStatus;
  scope: EvidenceScope;
  assertion?: string;
  expected?: unknown;
  actual?: unknown;
  rootCauseId?: string;
  blockedBy?: string[];
  source: string;
  sourceSha?: string;
  commitSha: string;
  treeSha?: string;
  toolchainFingerprint: string;
  lockfileHash: string;
  contractHash: string;
  ciConfigHash: string;
  inputHash: string;
  evidenceId: string;
  createdAt: string;
}

export interface EvidenceManifest {
  schemaVersion: 1;
  commitSha: string;
  treeSha?: string;
  workflow?: string;
  runId?: string;
  contractHash: string;
  ciConfigHash: string;
  entries: Array<{
    evidenceId: string;
    contract: string;
    status: EvidenceStatus;
    scope: EvidenceScope;
    path: string;
    sha256: string;
  }>;
  manifestHash: string;
}
