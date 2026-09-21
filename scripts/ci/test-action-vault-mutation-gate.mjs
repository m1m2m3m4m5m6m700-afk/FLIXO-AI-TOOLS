import assert from 'node:assert/strict';
import { evaluateMutationGate } from './action-vault-mutation-gate.mjs';

const sha='a'.repeat(40);
const fp='fp';
const completeness=Object.fromEntries([
 'COGNITIVE_AWARENESS_PROVEN','CAUSAL_EVIDENCE_GRAPH_PROVEN','ROOT_CAUSE_PROVEN','FILE_SELECTION_PROVEN','PROGRAMMER_TWIN_PARITY_PROVEN',
 'ADVERSARIAL_FALSIFICATION_COMPLETE','NO_VALID_COUNTEREXAMPLE','SANDBOX_SIMULATION_PASSED',
 'DIFFERENTIAL_CHECK_PASSED','PATCH_CORRECTNESS_PROVEN','REGRESSION_COUNTEREXAMPLES_EXHAUSTED',
 'NO_SCOPE_VIOLATION','NO_TEST_MUTATION','NO_CONTROL_PLANE_MUTATION','NO_MAIN_MUTATION','NO_GATE_WEAKENING'
].map(k=>[k,true]));
const verifier={
 status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
 verifierAgent:'actionRepairVerifier',
 targetSha:sha,failureFingerprint:fp,
 alternativeHypotheses:[{id:'alt'}],falsificationChecks:[{id:'f'}],falsificationSearches:Array.from({length:10},()=>({})),
 counterEvidence:{noCounterexampleIsNotPatchCorrect:true},
 role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',challengeMode:'FALSIFY_PRIMARY',
 programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:sha,failureFingerprint:fp},
 cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',systemWide:true,targetSha:sha,failureFingerprint:fp},
 primaryCorrectnessProof:{objective:'PROVE_PRIMARY_REPAIR_CORRECT',status:'PRIMARY_CORRECTNESS_PROVEN'},
 falsificationComplete:true,counterexampleFound:false,
 mutationRecommendation:'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
 remainingRisks:['canonical-ci'],proofCompleteness:completeness,preMutationProof:{status:'PROVEN',targetSha:sha,failureFingerprint:fp},
};
const base={
 targetSha:sha,currentSha:sha,failureFingerprint:fp,verifierProof:verifier,
 catalogReview:{status:'REVIEWED',reviewer:'ACTION-HISTORIAN-3',beforeMutation:true,mutationAuthority:false,taskId:'task',fingerprint:fp,targetSha:sha,source:{indexId:'ACTION-INDEX-4000',declaredCapacity:1000000,actualRecordCount:4000},digest:'d'.repeat(64)},
 cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',targetSha:sha,failureFingerprint:fp,awarenessCompleteness:{complete:true}},
 rootCauseProof:{protocol:'CAUSAL-EVIDENCE-GRAPH-v1',status:'PROVEN',targetSha:sha,failureFingerprint:fp,sourceMutationAllowed:false,proofClaims:{ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL:true,LOCATION_LINKED_TO_CAUSE:true,MECHANISM_EXPLAINED:true,ALTERNATIVES_CHALLENGED:true}},
 fileSelection:{decision:'SELECTED',targetSha:sha,failureFingerprint:fp,selectedFiles:[{path:'src/example.ts'}]},
 programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:sha,failureFingerprint:fp},
 falsificationReport:{falsificationComplete:true,counterexampleFound:false,targetSha:sha,failureFingerprint:fp},
 simulationProof:{status:'PASS'},
 differentialProof:{status:'PASS'},
 patchCorrectness:{status:'PROVEN',proofCompleteness:{PATCH_TARGET_PROVEN:true,PATCH_MECHANISM_PROVEN:true}},
 regressionCounterexamples:{counterexampleFound:false,exhausted:true},
 mutationScope:{testMutation:false,controlPlaneMutation:false,mainMutation:false,gateWeakening:false},
 branch:'execution'
};
const pass=evaluateMutationGate(base);
assert.equal(pass.status,'PASS');
assert.equal(pass.mutationAllowed,true);

for(const key of ['CATALOG_REVIEW','COGNITIVE_AWARENESS','SANDBOX_SIMULATION','DIFFERENTIAL_VERIFICATION','PATCH_CORRECTNESS']){
 const copy={...base};
 if(key==='COGNITIVE_AWARENESS') copy.cognitiveAwareness={};
 if(key==='SANDBOX_SIMULATION') copy.simulationProof={status:'BLOCK'};
 if(key==='DIFFERENTIAL_VERIFICATION') copy.differentialProof={status:'BLOCK'};
 if(key==='PATCH_CORRECTNESS') copy.patchCorrectness={status:'BLOCK'};
 const blocked=evaluateMutationGate(copy);
 assert.equal(blocked.status,'BLOCK',key);
}
const weakened=evaluateMutationGate({...base,mutationScope:{...base.mutationScope,gateWeakening:true}});
assert.equal(weakened.status,'BLOCK');
console.log('ACTION_VAULT_MUTATION_GATE=PASS');