import assert from 'node:assert/strict';
import fs from 'node:fs';

const assessor=fs.readFileSync('scripts/ci/post-patch-adversarial-assessor.mjs','utf8');
const parallel=fs.readFileSync('scripts/ci/candidate-verification-parallel.mjs','utf8');
const engine=fs.readFileSync('scripts/ci/auto-repair-engine.mjs','utf8');
const config=fs.readFileSync('configs/in-repo-repair-v2.yml','utf8');

assert.match(assessor,/FLIXO-POST-PATCH-ADVERSARIAL-v2/);
assert.match(assessor,/falsifierVerdict/);
assert.match(assessor,/PASS_CONFIRMED/);
assert.match(assessor,/REJECTED_WITH_COUNTER_EXAMPLE/);
assert.match(assessor,/convergenceDirective/);
assert.match(assessor,/finiteInvariantProof/);
assert.match(assessor,/RCA_MANIFEST/);

assert.match(parallel,/falsifierVerdict==='PASS_CONFIRMED'/);
assert.match(parallel,/finiteInvariantProof\?\.status==='PROVEN'/);
assert.match(parallel,/passConfirmed===true/);
assert.match(parallel,/FLIXO_RCA_MANIFEST_PATH/);

assert.match(engine,/in-repo-repair-v2\.mjs/);
assert.match(engine,/buildRcaManifest/);
assert.match(engine,/validateRcaManifest/);
assert.match(engine,/enforceMutationScope/);
assert.match(engine,/in-repo-repair-v2-gate-blocked/);

assert.match(config,/max_repair_cycles:\s*3/);
assert.match(config,/allow_multi_file_mutation:\s*false/);
assert.match(config,/mode: CONVERGENCE_GUIDED/);
assert.match(config,/require_pass_confirmed:\s*true/);

console.log('POST_PATCH_ADVERSARIAL_V2_CONTRACT=PASS');
