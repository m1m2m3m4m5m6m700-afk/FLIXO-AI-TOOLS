import type { CiContract } from '../core/types.ts';

export const CI_CONTRACTS: readonly CiContract[] = [
  {
    id: 'CI-TOOLCHAIN-001', version: 1, gate: 'TOOLCHAIN', name: 'Canonical toolchain',
    dependencies: [], inputs: ['.nvmrc', 'package-lock.json', 'package.json'], outputs: ['toolchain-fingerprint'], evaluator: 'toolchain', scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'CI-CONFIG-001', version: 1, gate: 'TOOLCHAIN', name: 'CI configuration integrity',
    dependencies: [], inputs: ['scripts/ci/contracts/registry.ts'], outputs: ['ci-config-hash'], evaluator: 'config', scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'CI-DECISION-001', version: 1, gate: 'TOOLCHAIN', name: 'Central decision semantics',
    dependencies: [], inputs: ['scripts/ci/core/status.ts'], outputs: ['decision'], evaluator: 'decision', scope: 'repository', severity: 'critical', execution: 'unit', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-REGISTRY-001', version: 1, gate: 'G1', name: 'Registry integrity and uniqueness',
    dependencies: ['CI-TOOLCHAIN-001'], inputs: ['src/config/tools.ts', 'src/config/tool-manifest.ts'], outputs: ['registry-evidence'], evaluator: 'scripts/test-platform-contract.mjs#registry', scope: 'repository', severity: 'critical', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-READY-001', version: 1, gate: 'G1', name: 'Ready-state and 404 boundary',
    dependencies: ['G1-REGISTRY-001'], inputs: ['src/routes/localized-tool.tsx', 'src/config/tool-manifest.ts'], outputs: ['ready-state-evidence'], evaluator: 'scripts/test-platform-contract.mjs#readiness', scope: 'route', severity: 'critical', execution: 'integration', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-ROUTER-001', version: 1, gate: 'G1', name: 'Router registry parity',
    dependencies: ['G1-REGISTRY-001', 'G1-READY-001'], inputs: ['src/lib/routing/route-resolver.ts', 'src/routes/localized-tool.tsx'], outputs: ['router-evidence'], evaluator: 'scripts/test-platform-contract.mjs#router', scope: 'route', severity: 'critical', execution: 'integration', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-ROUTE-001', version: 1, gate: 'G1', name: 'Canonical localized route resolution',
    dependencies: ['G1-ROUTER-001'], inputs: ['src/lib/routing/route-resolver.ts', 'src/config/tools.ts'], outputs: ['route-evidence'], evaluator: 'scripts/test-platform-contract.mjs#route', scope: 'route', severity: 'critical', execution: 'integration', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-SITEMAP-001', version: 1, gate: 'G1', name: 'Sitemap parity and discovery boundary',
    dependencies: ['G1-ROUTE-001'], inputs: ['scripts/generate-sitemap.mjs'], outputs: ['sitemap-evidence'], evaluator: 'scripts/test-platform-contract.mjs#sitemap', scope: 'route', severity: 'critical', execution: 'integration', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-SEO-001', version: 1, gate: 'G1', name: 'SEO binding parity',
    dependencies: ['G1-ROUTE-001'], inputs: ['src/lib/seo/tool-seo.ts'], outputs: ['seo-evidence'], evaluator: 'scripts/test-platform-contract.mjs#seo', scope: 'locale', severity: 'critical', execution: 'integration', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-CANONICAL-001', version: 1, gate: 'G1', name: 'Canonical production origin',
    dependencies: ['G1-SEO-001'], inputs: ['src/lib/i18n/config.ts', 'scripts/validate-site-origin.mjs'], outputs: ['canonical-evidence'], evaluator: 'scripts/test-platform-contract.mjs#canonical', scope: 'repository', severity: 'critical', execution: 'integration', reusable: false, retry: 'never', freshness: 'fresh', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-INDEXING-001', version: 1, gate: 'G1', name: 'Indexing contract',
    dependencies: ['G1-SITEMAP-001', 'G1-CANONICAL-001'], inputs: ['scripts/validate-indexing.mjs'], outputs: ['indexing-evidence'], evaluator: 'scripts/test-platform-contract.mjs#indexing', scope: 'route', severity: 'high', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
  {
    id: 'G1-LOCALE-MATRIX-001', version: 1, gate: 'G1', name: 'Supported locale matrix',
    dependencies: ['G1-REGISTRY-001'], inputs: ['src/lib/i18n/config.ts'], outputs: ['locale-matrix-evidence'], evaluator: 'scripts/test-platform-contract.mjs#locale-matrix', scope: 'locale', severity: 'high', execution: 'static', reusable: true, retry: 'never', freshness: 'dependency', escalation: { deep: true, full: true },
  },
];

export function getCiContract(id: string): CiContract | undefined {
  return CI_CONTRACTS.find((contract) => contract.id === id);
}
