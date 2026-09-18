export const repairPolicy = Object.freeze({
  maxAttemptsPerFingerprint: Number.POSITIVE_INFINITY, // No global cycle ceiling; per-cycle mutation budgets remain bounded.
  maxChangedFiles: 8,
  maxChangedLines: 300,
  requireCleanGitBeforeRepair: true,
  requireDeterministicMatch: true,
  neverModify: [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-flixoai.yml',
    '.github/workflows/auto-repair.yml',
    '.github/workflows/repair-seed.yml',
    'package-lock.json',
    '.env',
    '.env.*',
  ],
  protectedAreas: [
    'scripts/ci/certification-engine.mjs',
    'scripts/ci/validate-execution-graph.mjs',
    'tests/seed.spec.ts',
  ],
  requireVerification: ['typecheck', 'test:static', 'test:build'],
  openDraftPrOnly: true,
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
