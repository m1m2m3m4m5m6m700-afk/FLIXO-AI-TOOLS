import { TRUST_PERIMETER_PATHS } from './control-plane-registry.mjs';
export const repairPolicy = Object.freeze({
  // High-capacity repair ceiling: two million operations/cycles before policy-level exhaustion.
  // This is not a GREEN closure condition; canonical GREEN remains the only successful terminal state.
  maxAttemptsPerFingerprint: 2_000_000,
  maxRepairChainRuns: 2_000_000,
  maxChangedFiles: 8,
  maxChangedLines: 300,
  requireCleanGitBeforeRepair: true,
  requireDeterministicMatch: true,
  neverModify: [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-flixoai.yml',
    'package-lock.json',
    '.env',
    '.env.*',
  ],
  protectedAreas: [
    ...TRUST_PERIMETER_PATHS,
    'scripts/ci/certification-engine.mjs',
    'scripts/ci/repair-protocol.mjs',
    'scripts/ci/validate-execution-graph.mjs',
    'scripts/ci/auto-repair-supervisor.mjs',
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
