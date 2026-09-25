import assert from 'node:assert/strict';
import {
  buildOpenHandsAdvisorPrompt,
  runOpenHandsRepairAdvisor,
} from './auto-repair/openhands-repair-advisor.mjs';

process.env.FLIXO_OPENHANDS_ADVISOR_ENABLED = 'false';

const targetSha = 'a'.repeat(40);
const prompt = buildOpenHandsAdvisorPrompt({
  targetSha,
  failureFingerprint: 'b'.repeat(64),
  diagnosis: { targetSha, rootCause: 'lint', location: { file: 'src/example.ts', line: 10 } },
  failureLog: 'ERROR eslint no-unused-vars src/example.ts:10',
});

assert.match(prompt, /detached temporary workspace/u);
assert.match(prompt, /Never create or switch branches/u);
assert.match(prompt, /Never commit, push, merge/u);
assert.match(prompt, /FLIXO_CANONICAL_GATES/u);

const disabled = runOpenHandsRepairAdvisor({ targetSha });
assert.equal(disabled.status, 'DISABLED');
assert.equal(disabled.mutationAuthority, 'NONE');

console.log('OPENHANDS_REPAIR_ADVISOR_CONTRACT=PASS');
