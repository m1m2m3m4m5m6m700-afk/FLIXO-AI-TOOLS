import assert from 'node:assert/strict';
import { buildDifferentialProof } from './differential-repair-proof.mjs';

const ok=buildDifferentialProof({
 targetSha:'a'.repeat(40),failureFingerprint:'fp',
 changedPaths:['src/example.ts'],
 baseFiles:{'src/example.ts':'export function example(){return "bad";}\n'},
 candidateFiles:{'src/example.ts':'export function example(){return "good";}\n'},
 diff:'-bad +good',
 protectedPaths:['scripts/ci/'],
 verification:{ok:true,diffCheck:true,commands:[['node',['scripts/ci/test.mjs']]]},
 scopeFiles:['src/example.ts'],
});
assert.equal(ok.status,'PASS');
assert.equal(ok.scopeProof,true);
assert.equal(ok.testsUnmodified,true);
assert.equal(ok.astStructureCompared,true);

const blocked=buildDifferentialProof({
 targetSha:'b'.repeat(40),failureFingerprint:'fp',
 changedPaths:['scripts/ci/repair-protocol.mjs'],
 baseFiles:{'scripts/ci/repair-protocol.mjs':'x'},
 candidateFiles:{'scripts/ci/repair-protocol.mjs':'y'},
 verification:{ok:true,diffCheck:true},
 protectedPaths:['scripts/ci/'],
 scopeFiles:['scripts/ci/repair-protocol.mjs'],
});
assert.equal(blocked.status,'BLOCK');
assert.ok(blocked.failures.includes('DIFF_PROTECTED_SURFACE'));
console.log('DIFFERENTIAL_REPAIR_PROOF=PASS');