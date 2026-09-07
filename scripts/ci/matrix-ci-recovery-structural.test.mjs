import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const files = [
  'scripts/ci/matrix-test-identity.mjs',
  'scripts/ci/test-matrix-test-identity.mjs',
  'scripts/ci/agent-coordination-protocol.mjs',
  'scripts/ci/validate-agent-sessions.mjs',
  'scripts/ci/validate-agent-pr-collisions.mjs',
  'scripts/ci/weighted-shard-plan.mjs',
  'scripts/ci/write-matrix-evidence.mjs',
  'scripts/ci/validate-full-matrix-evidence.mjs',
  '.github/workflows/full-matrix-parallel.yml',
  '.github/workflows/matrix-ci-recovery.yml',
];
for (const file of files) assert.equal(existsSync(file), true, `missing ${file}`);
const workflow = readFileSync('.github/workflows/full-matrix-parallel.yml', 'utf8');
for (const marker of ['name: Matrix First', 'name: Matrix First Certification', '_flixo_matrix_plan.json', '--fail-on-flaky-tests', 'validate-full-matrix-evidence.mjs']) assert.match(workflow, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(readFileSync('scripts/ci/agent-coordination-protocol.mjs', 'utf8'), /merge-base.*is-ancestor|isAncestor/);
assert.match(readFileSync('scripts/ci/validate-agent-sessions.mjs', 'utf8'), /isAncestor/);
assert.match(readFileSync('scripts/ci/validate-agent-pr-collisions.mjs', 'utf8'), /assertClaimShaAnchored/);
console.log('Matrix/CI recovery structural invariants PASS');
