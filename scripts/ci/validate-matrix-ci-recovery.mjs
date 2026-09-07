import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const requireFile = (path) => {
  if (!existsSync(path)) throw new Error(`missing recovery component: ${path}`);
};

for (const path of [
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
]) requireFile(path);

const workflow = readFileSync('.github/workflows/full-matrix-parallel.yml', 'utf8');
for (const required of [
  'name: Matrix First',
  'name: Matrix First Certification',
  '_flixo_matrix_plan.json',
  '--fail-on-flaky-tests',
  'validate-full-matrix-evidence.mjs',
]) if (!workflow.includes(required)) throw new Error(`canonical matrix invariant missing: ${required}`);

execFileSync('node', ['scripts/ci/test-matrix-test-identity.mjs'], { stdio: 'inherit' });
console.log('Matrix/CI recovery structural validation PASS');
