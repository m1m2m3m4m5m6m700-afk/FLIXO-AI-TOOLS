import type { CiDecision, ContractResult, ContractStatus } from './types.ts';

export function computeCiDecision(results: readonly ContractResult[]): CiDecision {
  const required = results.filter((result) => result.severity === 'critical' || result.severity === 'high');
  const requiredFailures = required.filter((result) => result.status === 'FAIL').map((result) => result.contract);
  const requiredBlocked = required.filter((result) => result.status === 'BLOCKED').map((result) => result.contract);
  const evaluated = results.filter((result) => result.status !== 'BLOCKED' && result.status !== 'NOT_APPLICABLE').length;
  const reused = results.filter((result) => result.evidence?.some((evidence) => evidence.source === 'checkpoint')).length;
  const skipped = results.filter((result) => result.status === 'NOT_APPLICABLE').length;

  let status: ContractStatus = 'PASS';
  if (requiredFailures.length > 0) status = 'FAIL';
  else if (requiredBlocked.length > 0) status = 'BLOCKED';

  return { status, requiredFailures, requiredBlocked, evaluated, reused, skipped };
}
