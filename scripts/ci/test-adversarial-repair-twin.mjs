import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const twin = fs.readFileSync('scripts/ci/adversarial-repair-twin.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const strategy = fs.readFileSync('scripts/ci/repair-strategy.mjs', 'utf8');

assert.match(twin, /READ_ONLY_ADVERSARIAL_TWIN/);
assert.match(twin, /mutationAuthority: false/);
assert.match(twin, /repositoryWrite: false/);
assert.match(twin, /actionsWrite: false/);
assert.match(twin, /preferredAlternativeRepair/);
assert.match(twin, /TWIN_READ_ONLY_CONTRACT_REQUIRED/);
assert.doesNotMatch(twin, /git['"],\\s*\\[[^\\]]*push/i);
assert.doesNotMatch(twin, /gh['"],\\s*\\[[^\\]]*workflow\\s+run/i);
assert.doesNotMatch(twin, /--method['"],\\s*['"]POST/i);

assert.doesNotMatch(workflow, /adversarial_twin:/);
assert.doesNotMatch(workflow, /needs\\.adversarial_twin\\.outputs/);
assert.match(workflow, /Run adversarial twins locally inside the canonical repair trust domain/);
assert.match(workflow, /validate-adversarial-repair-twin\\.mjs/);
assert.match(workflow, /FLIXO_HISTORICAL_SOLUTION_PATH: \/tmp\/flixo-historical-solution-index\\.json/);
assert.match(workflow, /FLIXO_TWIN_A_PATH: \/tmp\/flixo-twin-a\\.json/);
assert.match(workflow, /FLIXO_TWIN_B_PATH: \/tmp\/flixo-twin-b\\.json/);
assert.match(workflow, /FLIXO_SELECTION_PATH: \/tmp\/flixo-selected-repair-option\\.json/);
assert.doesNotMatch(workflow, /FLIXO_SELECTED_REPAIR_STRATEGY=.*>> "\$GITHUB_ENV"/);
assert.doesNotMatch(workflow, /FLIXO_REPAIR_ACTOR=.*>> "\$GITHUB_ENV"/);

assert.match(strategy, /FLIXO_TWIN_PROPOSAL_PATH/);
assert.match(strategy, /twinPreferredStrategy/);
assert.match(strategy, /divergentIndexes/);
const parallel=fs.readFileSync('scripts/ci/candidate-verification-parallel.mjs','utf8');
assert.match(parallel,/FLIXO-CANDIDATE-PARALLEL-VERIFICATION-v1/);
assert.match(parallel,/targetedRegression/);
assert.match(parallel,/adversarialNoCounterexample/);
assert.match(parallel,/falsifierVerdict==='PASS_CONFIRMED'/);
assert.match(parallel,/finiteInvariantProof\?\.status==='PROVEN'/);
assert.match(parallel,/killGroup\(regression.child\)/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-twin-test-'));
const logPath = path.join(temp, 'failure.log');
const outputPath = path.join(temp, 'twin-result.json');
fs.writeFileSync(logPath, 'Run failed: src/example.ts:10:5 no-unused-vars defined but never used\n');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch === 'execution') {
  execFileSync(process.execPath, ['scripts/ci/adversarial-repair-twin.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      FLIXO_TARGET_DIR: root,
      FLIXO_FAILURE_LOG: logPath,
      FLIXO_TWIN_OUTPUT: outputPath,
      FLIXO_EXPECTED_TARGET_SHA: sha,
      FLIXO_TWIN_READ_ONLY: 'true',
    },
    stdio: 'pipe',
  });
  const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(result.mutationAuthority, false);
  assert.equal(result.repositoryWrite, false);
  assert.equal(result.actionsWrite, false);
  assert.equal(typeof result.challenge?.preferredAlternativeRepair, 'string');
  assert.equal(result.targetSha, sha);
  assert.equal(result.challenge?.rule, 'NEVER_WRITE_SOURCE_AND_NEVER_CONTROL_ACTIONS');
}

console.log('ADVERSARIAL_REPAIR_TWIN_CONTRACT=PASS');
