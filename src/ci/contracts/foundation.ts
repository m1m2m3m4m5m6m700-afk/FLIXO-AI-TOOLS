export const CONTRACT_VERSION = 1 as const;

export const CONTRACT_STATUSES = [
  'PASS',
  'FAIL',
  'BLOCKED',
  'NOT_APPLICABLE',
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface ContractScope {
  readonly toolId?: string;
  readonly route?: string;
  readonly locale?: string;
  readonly file?: string;
}

export interface ContractEvidence {
  readonly source?: string;
  readonly line?: number;
  readonly artifact?: string;
}

export interface ContractResult {
  readonly gate: string;
  readonly contract: string;
  readonly status: ContractStatus;
  readonly scope: ContractScope;
  readonly rootCauseId?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly assertion?: string;
  readonly evidence?: ContractEvidence;
  readonly blockedBy?: readonly string[];
}

export interface ContractDefinition {
  readonly id: string;
  readonly version: number;
  readonly gate: string;
  readonly description: string;
}

export function isContractStatus(value: unknown): value is ContractStatus {
  return typeof value === 'string' && (CONTRACT_STATUSES as readonly string[]).includes(value);
}

export function assertContractResult(value: unknown): asserts value is ContractResult {
  if (!value || typeof value !== 'object') throw new TypeError('ContractResult must be an object');
  const result = value as Record<string, unknown>;
  if (typeof result.gate !== 'string' || result.gate.length === 0) throw new TypeError('ContractResult.gate is required');
  if (typeof result.contract !== 'string' || result.contract.length === 0) throw new TypeError('ContractResult.contract is required');
  if (!isContractStatus(result.status)) throw new TypeError('ContractResult.status is invalid');
  if (!result.scope || typeof result.scope !== 'object') throw new TypeError('ContractResult.scope is required');
}
