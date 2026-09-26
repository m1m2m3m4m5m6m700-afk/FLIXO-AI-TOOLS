import assert from 'node:assert/strict';
import { evaluateGreenFirstPolicy, selectLatestNonCancelled } from './green-first-addition-policy.mjs';
const greenFeature = evaluateGreenFirstPolicy({ parentGreen: true, subject: 'feat(image): add visual critic', changedFiles: ['src/lib/agent/visual-critic.ts'] });
assert.equal(greenFeature.allowed, true);
assert.equal(greenFeature.state, 'OPEN');
const redFeature = evaluateGreenFirstPolicy({ parentGreen: false, subject: 'feat(agent): add agent registry', changedFiles: ['src/lib/agent/agent-registry.ts'] });
assert.equal(redFeature.allowed, false);
assert.equal(redFeature.reason, 'RED_SCOPE_REQUIRES_EXPLICIT_CLASSIFICATION');
const redBoundedFeature = evaluateGreenFirstPolicy({ parentGreen: false, subject: 'feat(agent): add visual verifier [ADD:VISUAL-001] [WP:VISUAL-001]', changedFiles: ['src/lib/agent/visual-goal-verifier.ts'] });
assert.equal(redBoundedFeature.allowed, true);
assert.equal(redBoundedFeature.state, 'ADDITIVE_SCOPE');
assert.equal(redBoundedFeature.reason, 'RED_BOUNDED_ADDITION');
const redRepair = evaluateGreenFirstPolicy({ parentGreen: false, subject: 'fix(ci): close exact-sha blocker [REPAIR:CI-GREEN-001] [WP:MVP-CLOSURE-001]', changedFiles: ['scripts/ci/exact-sha-gate.mjs'] });
assert.equal(redRepair.allowed, true);
assert.equal(redRepair.state, 'REPAIR_SCOPE');
const redRepairWithoutWp = evaluateGreenFirstPolicy({ parentGreen: false, subject: 'fix(ci): close exact-sha blocker [REPAIR:CI-GREEN-001]', changedFiles: ['scripts/ci/exact-sha-gate.mjs'] });
assert.equal(redRepairWithoutWp.allowed, false);
console.log('GREEN_FIRST_ADDITION_POLICY_TEST=PASS');

const redDocumentationWithoutClassification = evaluateGreenFirstPolicy({
  parentGreen: false,
  subject: 'docs: update repository governance',
  changedFiles: ['CONTRIBUTING.md', 'docs/governance/FLIXO-GREEN-FIRST-ADDITION-POLICY.md'],
});
assert.equal(redDocumentationWithoutClassification.allowed, false);
assert.equal(redDocumentationWithoutClassification.reason, 'RED_SCOPE_REQUIRES_EXPLICIT_CLASSIFICATION');\nconst selected = selectLatestNonCancelled([\n  { conclusion: 'success', updated_at: '2026-09-26T17:25:00Z' },\n  { conclusion: 'cancelled', updated_at: '2026-09-26T17:26:00Z' },\n]);\nassert.equal(selected?.conclusion, 'success');\n\nconst latestFailure = selectLatestNonCancelled([\n  { conclusion: 'success', updated_at: '2026-09-26T17:25:00Z' },\n  { conclusion: 'failure', updated_at: '2026-09-26T17:26:00Z' },\n  { conclusion: 'cancelled', updated_at: '2026-09-26T17:27:00Z' },\n]);\nassert.equal(latestFailure?.conclusion, 'failure');\n