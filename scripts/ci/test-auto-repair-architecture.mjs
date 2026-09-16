import assert from 'node:assert/strict';
import { fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { isPathAllowed, isProtectedPath } from './auto-repair-policy.mjs';

const sample = 'Run 35012345678 failed: no-unused-vars';
const normalized = normalizeFailure(sample);
assert(!normalized.includes('35012345678'));
assert.equal(fingerprintFailure(sample), fingerprintFailure(sample));

const plan = planRepair(sample);
assert.equal(plan.selected?.id, 'eslint-unused');
assert(plan.selected.confidence >= 90);
assert.equal(isPathAllowed('.github/workflows/ci.yml'), false);
assert.equal(isProtectedPath('tests/seed.spec.ts'), true);
assert.equal(isPathAllowed('src/example.ts'), true);
assert.equal(planRepair('webkit waitForGpuRender timeout').selected, null);
assert.equal(planRepair('typescript TS2322 type error').selected, null);

console.log('AUTO_REPAIR_ARCHITECTURE_SELF_TEST=PASS');
