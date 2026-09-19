import assert from 'node:assert/strict';
import { fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { isPathAllowed, isProtectedPath, repairPolicy } from './auto-repair-policy.mjs';

const lint = 'Run 35012345678 failed: abcdefabcdefabcdefabcdefabcdefabcdefabcd no-unused-vars';
assert(!normalizeFailure(lint).includes('35012345678'));
assert.equal(fingerprintFailure(lint), fingerprintFailure(lint));
const plan = planRepair(lint);
assert.equal(plan.selected.id, 'eslint-unused');
assert.equal(confidenceGate({ selected: plan.selected, features: plan.features }).allowed, true);
assert.equal(selectSpecialist(plan.features).id, 'eslint-specialist');
assert.equal(planRepair('webkit waitForGpuRender timeout').selected, null);
assert.equal(planRepair('certification FAST 66 DEEP 60').selected, null);
assert.equal(isPathAllowed('.github/workflows/ci.yml'), false);
assert.equal(isProtectedPath('tests/seed.spec.ts'), true);
assert.equal(isPathAllowed('src/example.ts'), true);
assert.equal(repairPolicy.maxAttemptsPerFingerprint, 3);
assert.equal(repairPolicy.maxRepairChainRuns, 8);
assert.equal(repairPolicy.maxChangedFiles, 8);
assert.equal(repairPolicy.maxChangedLines, 300);
assert.equal(repairPolicy.openDraftPrOnly, false);
for (const path of [
  '.github/workflows/auto-repair-executor.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/auto-repair/',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repository-security-baseline.mjs',
  'scripts/ci/validate-auto-repair-memory.mjs',
]) {
  assert.equal(isPathAllowed(path), false, `trust perimeter must remain immutable to auto-repair: ${path}`);
}
console.log('AUTO_REPAIR_FINAL_ARCHITECTURE=PASS');
