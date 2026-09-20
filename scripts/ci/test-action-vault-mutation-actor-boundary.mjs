import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('scripts/ci/auto-repair-engine.mjs','utf8');
const gate=source.indexOf('const mutationGate = evaluateMutationGate(');
const mutate=source.indexOf('evidence.repair = runAstRepair(targetDir, selected);');
assert.ok(gate>=0,'hard mutation gate missing');
assert.ok(mutate>=0,'mutation call missing');
assert.ok(gate<mutate,'hard mutation gate must precede runAstRepair');
assert.ok(
  !source.includes("if (repairActor === 'actionRepairBot') {\n  const gateCurrentSha"),
  'hard mutation gate must not be restricted to ACTION-REPAIR'
);
assert.match(source,/if \(mutationGate\.status !== 'PASS'\)/u);
assert.match(source,/rootCauseProof: preMutationProof\.rootCauseProof/u);
console.log('ACTION_VAULT_MUTATION_ACTOR_BOUNDARY=PASS');
