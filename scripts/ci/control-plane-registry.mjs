export const REPAIR_GATE_AUTOMATION = Object.freeze([
  'auto-repair.yml',
  'daily-flixo-green-gate.yml',
  'execution-sync.yml',
]);

export const WRITE_CAPABLE_WORKFLOWS = Object.freeze([
  'auto-repair.yml',
  'execution-sync.yml',
]);

export const SECURITY_CRITICAL_WORKFLOWS = Object.freeze([
  'auto-repair.yml',
  'execution-sync.yml',
  'wp0-trust-baseline.yml',
]);

export const HISTORICAL_REPAIR_WORKFLOWS = Object.freeze([
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
  'FLIXO Continuous Delivery',
  'Daily·FLIXO Green Gate',
  'FLIXO Auto Repair Bot',
  'FLIXO Execution Canonical Sync',
]);

export const TRUST_PERIMETER_PATHS = Object.freeze([
  '.github/workflows/auto-repair.yml',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/auto-repair-proof.mjs',
  'scripts/ci/auto-repair/',
  'scripts/ci/auto-repair/ai-phase1.mjs',
  'scripts/ci/auto-repair/ai-phase2.mjs',
  'scripts/ci/auto-repair/ai-phase3.mjs',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repository-security-baseline.mjs',
  'scripts/ci/validate-auto-repair-memory.mjs',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-ci-cd-trust.mjs',
  'scripts/ci/validate-wp0-trust-baseline.mjs',
]);
