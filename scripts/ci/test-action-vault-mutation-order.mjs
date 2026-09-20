import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('scripts/ci/auto-repair-engine.mjs','utf8');
const gate=source.indexOf('const mutationGate = evaluateMutationGate(');
const mutate=source.indexOf('evidence.repair = runAstRepair(targetDir, selected);');
assert.ok(gate>=0,'hard mutation gate missing');
assert.ok(mutate>=0,'mutation call missing');
assert.ok(gate<mutate,'mutation gate must precede runAstRepair');
assert.match(source,/preMutationProof\.protocol === 'REPAIR-SIMULATION-PROOF-v1'/u);
assert.match(source,/mutationGate\.status !== 'PASS'/u);
console.log('ACTION_VAULT_MUTATION_ORDER=PASS');