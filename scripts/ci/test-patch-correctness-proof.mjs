import assert from 'node:assert/strict';
import { buildPatchCorrectnessProof } from './patch-correctness-proof.mjs';

const base={
 targetSha:'a'.repeat(40),failureFingerprint:'fp',
 diagnosis:{diagnosisQuality:'strong',causalConfidence:0.9,ambiguity:false,directFailureSignal:true,rootCause:'lint',location:{file:'src/example.ts'}},
 plan:{id:'eslint-unused',file:'src/example.ts'},
 fileSelection:{decision:'SELECTED',targetSha:'a'.repeat(40),failureFingerprint:'fp',selectedFiles:[{path:'src/example.ts'}]},
 awareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',targetSha:'a'.repeat(40),failureFingerprint:'fp',awarenessCompleteness:{complete:true}},
 twin:{role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',targetSha:'a'.repeat(40),failureFingerprint:'fp',falsificationComplete:true,counterexampleFound:false},
 simulation:{ok:true,scopeOk:true,behavioralVerification:{ok:true}},
 differential:{status:'PASS',scopeProof:true},
 regressionCounterexamples:{searchedCount:12,requiredSearches:12,exhausted:true,counterexampleFound:false},
 targetedRegression:{ok:true},
 primaryProof:{status:'PRIMARY_CORRECTNESS_PROVEN',proofObjective:'PROVE_PRIMARY_REPAIR_CORRECT',targetSha:'a'.repeat(40),failureFingerprint:'fp'},
 scopeCheck:true,noTestMutation:true,noControlPlaneMutation:true,noMainMutation:true,noGateWeakening:true
};
const pass=buildPatchCorrectnessProof(base);
assert.equal(pass.status,'PROVEN');
assert.equal(pass.sourceMutationAllowed,false);
assert.equal(pass.proofCompleteness.ROOT_CAUSE_PROVEN,true);
assert.equal(pass.proofCompleteness.DIFFERENTIAL_CHECK_PASSED,true);
assert.equal(pass.proofCompleteness.NO_VALID_COUNTEREXAMPLE,true);

const blocked=buildPatchCorrectnessProof({...base,regressionCounterexamples:{searchedCount:11,requiredSearches:12,exhausted:false,counterexampleFound:false}});
assert.equal(blocked.status,'BLOCK');
assert.ok(blocked.remainingRisks.includes('REGRESSION_RISK_NOT_ANALYZED'));
console.log('PATCH_CORRECTNESS_PROOF=PASS');