import { REPAIR_GATE_AUTOMATION } from './control-plane-registry.mjs';
export const repairPolicy = Object.freeze({
  maxAttemptsPerFingerprint: 3,
  maxRepairChainRuns: 8,
  maxChangedFiles: 8,
  maxChangedLines: 300,
  requireCleanGitBeforeRepair: true,
  requireDeterministicMatch: true,
  neverModify: [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-flixoai.yml',
    ...REPAIR_GATE_AUTOMATION.map((name) => `.github/workflows/${name}`),
    '.github/workflows/wp0-trust-baseline.yml',
    'package-lock.json',
    '.env',
    '.env.*',
  ],
  protectedAreas: [
    'scripts/ci/certification-engine.mjs',
    'scripts/ci/validate-execution-graph.mjs',
    'scripts/ci/auto-repair-policy.mjs',
    'scripts/ci/auto-repair-engine.mjs',
    'scripts/ci/auto-repair-learning.mjs',
    'scripts/ci/auto-repair-supervisor.mjs',
    'scripts/ci/auto-repair-proof.mjs',
    'scripts/ci/auto-repair/',
    'scripts/ci/task-agent.mjs',
    'scripts/ci/agent-execution-control.mjs',
    'scripts/ci/repository-security-baseline.mjs',
    'scripts/ci/validate-auto-repair-memory.mjs',
    'scripts/ci/validate-certification-surface.mjs',
    'scripts/ci/validate-ci-cd-trust.mjs',
    'scripts/ci/validate-wp0-trust-baseline.mjs',
    'tests/seed.spec.ts',
  ],
  requireVerification: ['typecheck', 'test:static', 'test:build'],
  openDraftPrOnly: false,
});

function matches(path, rule) {
  return rule.endsWith('/') ? path.startsWith(rule) : path === rule;
}

export function isPathAllowed(path) {
  return !repairPolicy.neverModify.some((rule) => matches(path, rule))
    && !repairPolicy.protectedAreas.some((rule) => matches(path, rule));
}

export function isProtectedPath(path) {
  return repairPolicy.protectedAreas.some((rule) => matches(path, rule));
}
