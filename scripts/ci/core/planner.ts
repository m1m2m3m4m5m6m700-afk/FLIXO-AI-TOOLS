import { createHash } from 'node:crypto';
import type { CiContract } from './types.ts';
import { dependencyClosure, topologicalOrder } from './graph.ts';

export interface ExecutionPlan {
  schemaVersion: 1;
  commitSha: string;
  baseSha: string;
  mode: string;
  contractIds: string[];
  executionOrder: string[];
  contractHash: string;
  planHash: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

export function createExecutionPlan(input: {
  commitSha: string;
  baseSha: string;
  mode: string;
  requestedContracts: readonly string[];
  contractHash: string;
  contracts: readonly CiContract[];
}): ExecutionPlan {
  const contractIds = dependencyClosure(input.requestedContracts, input.contracts);
  const executionOrder = topologicalOrder(input.contracts.filter((contract) => contractIds.includes(contract.id)));
  const plan = {
    schemaVersion: 1 as const,
    commitSha: input.commitSha,
    baseSha: input.baseSha,
    mode: input.mode,
    contractIds,
    executionOrder,
    contractHash: input.contractHash,
  };
  return { ...plan, planHash: hash(plan) };
}
