import type { CiContract } from '../core/types.ts';

export const CI_CONTRACTS: readonly CiContract[] = [
  {
    id: 'CI-TOOLCHAIN-001', version: 1, gate: 'TOOLCHAIN', name: 'Canonical toolchain',
    dependencies: [], inputs: ['.nvmrc', 'package-lock.json', 'package.json'], outputs: ['toolchain-fingerprint'],
    evaluator: 'toolchain', scope: 'repository', severity: 'critical', execution: 'static', reusable: true,
    retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'CI-CONFIG-001', version: 1, gate: 'TOOLCHAIN', name: 'CI configuration integrity',
    dependencies: [], inputs: ['scripts/ci/contracts/registry.ts'], outputs: ['ci-config-hash'],
    evaluator: 'config', scope: 'repository', severity: 'critical', execution: 'static', reusable: true,
    retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'CI-DECISION-001', version: 1, gate: 'TOOLCHAIN', name: 'Central decision semantics',
    dependencies: [], inputs: ['scripts/ci/core/status.ts'], outputs: ['decision'],
    evaluator: 'decision', scope: 'repository', severity: 'critical', execution: 'unit', reusable: true,
    retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
];

export function getCiContract(id: string): CiContract | undefined {
  return CI_CONTRACTS.find((contract) => contract.id === id);
}
