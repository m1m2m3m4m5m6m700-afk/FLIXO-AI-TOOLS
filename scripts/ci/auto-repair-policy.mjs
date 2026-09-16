export const repairPolicy = Object.freeze({
  maxAttemptsPerRun: 2,
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

export function isPathAllowed(path) {
  return !repairPolicy.neverModify.some((blocked) =>
    blocked.endsWith('/') ? path.startsWith(blocked) : path === blocked,
  );
}
