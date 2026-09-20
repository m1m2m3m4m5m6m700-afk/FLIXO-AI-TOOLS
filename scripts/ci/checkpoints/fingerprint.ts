import { createHash } from 'node:crypto';
import type { CiContract, CiExecutionContext } from '../core/types.ts';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export interface CheckpointIdentity {
  commitSha: string;
  contractId: string;
  contractVersion: number;
  inputHash: string;
  dependencyHash: string;
  lockfileHash: string;
  toolchainHash: string;
  configHash: string;
  ciConfigHash: string;
}

export function fingerprintCheckpoint(contract: CiContract, context: CiExecutionContext, inputHash: string, dependencyHash: string): string {
  const identity: CheckpointIdentity = {
    commitSha: context.commitSha,
    contractId: contract.id,
    contractVersion: contract.version,
    inputHash,
    dependencyHash,
    lockfileHash: context.lockfileHash,
    toolchainHash: context.toolchainFingerprint,
    configHash: context.configHash,
    ciConfigHash: context.ciConfigHash,
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(identity)), 'utf8').digest('hex');
}

export function isCheckpointIdentityValid(checkpoint: CheckpointIdentity, current: CheckpointIdentity): boolean {
  return JSON.stringify(canonicalize(checkpoint)) === JSON.stringify(canonicalize(current));
}
