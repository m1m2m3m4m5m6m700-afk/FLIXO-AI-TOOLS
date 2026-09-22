#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  validateActionVaultVerifierProof,
  validateActionVaultPreMutationProofs,
  validateErrorOnlyMutation,
  assertAgentAdmission,
} from './repair-protocol.mjs';
import { evaluateMutationGate } from './action-vault-mutation-gate.mjs';
import { buildFiveXExecutionEnvelope } from './read-only-power-profile.mjs';
import { buildPatchCorrectnessProof } from './patch-correctness-proof.mjs';
import { evaluateCertification } from './action-vault-certification.mjs';

const benchmarkVersion='ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1';
const spec=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1.json','utf8'));
const GATE_INTEGRITY_ADVERSARIAL='GATE_INTEGRITY_ADVERSARIAL';
const sha='a'.repeat(40);
const fp='benchmark-fingerprint';
const completeness=Object.fromEntries([
  'COGNITIVE_AWARENESS_PROVEN','CAUSAL_EVIDENCE_GRAPH_PROVEN','ROOT_CAUSE_PROVEN','FILE_SELECTION_PROVEN','PROGRAMMER_TWIN_PARITY_PROVEN',
  'ADVERSARIAL_FALSIFICATION_COMPLETE','NO_VALID_COUNTEREXAMPLE','SANDBOX_SIMULATION_PASSED',
  'DIFFERENTIAL_CHECK_PASSED','PATCH_CORRECTNESS_PROVEN','REGRESSION_COUNTEREXAMPLES_EXHAUSTED',
  'NO_SCOPE_VIOLATION','NO_TEST_MUTATION','NO_CONTROL_PLANE_MUTATION','NO_MAIN_MUTATION','NO_GATE_WEAKENING'
].map(k=>[k,true]));
const verifier={
  status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',verifierAgent:'actionRepairVerifier',targetSha:sha,failureFingerprint:fp,
  alternativeHypotheses:[{id:'alt'}],falsificationChecks:[{id:'f'}],falsificationSearches:Array.from({length:10},()=>({})),
  counterEvidence:{noCounterexampleIsNotPatchCorrect:true},role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',challengeMode:'FALSIFY_PRIMARY',
  programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:sha,failureFingerprint:fp},
  cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',systemWide:true,targetSha:sha,failureFingerprint:fp},
  primaryCorrectnessProof:{objective:'PROVE_PRIMARY_REPAIR_CORRECT',status:'PRIMARY_CORRECTNESS_PROVEN'},
  falsificationComplete:true,counterexampleFound:false,mutationRecommendation:'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
  remainingRisks:[],proofCompleteness:completeness,
  preMutationProof:{status:'PROVEN',targetSha:sha,failureFingerprint:fp},
};
const base={
  targetSha:sha,currentSha:sha,failureFingerprint:fp,verifierProof:verifier,branch:'execution',
  cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',targetSha:sha,failureFingerprint:fp,awarenessCompleteness:{complete:true}},
  rootCauseProof:{status:'PROVEN'},
  fileSelection:{decision:'SELECTED',targetSha:sha,failureFingerprint:fp,selectedFiles:[{path:'src/example.ts'}]},
  programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:sha,failureFingerprint:fp},
  falsificationReport:{falsificationComplete:true,counterexampleFound:false,targetSha:sha,failureFingerprint:fp},
  simulationProof:{status:'PASS',ok:true},
  differentialProof:{status:'PASS',scopeProof:true,behavioralVerification:{ok:true},exactShaBound:true},
  patchCorrectness:{status:'PROVEN',proofCompleteness:{PATCH_TARGET_PROVEN:true,PATCH_MECHANISM_PROVEN:true}},
  regressionCounterexamples:{counterexampleFound:false,exhausted:true},
  mutationScope:{testMutation:false,controlPlaneMutation:false,mainMutation:false,gateWeakening:false},
  fiveXEnvelope:buildFiveXExecutionEnvelope({
    exactSha:sha,branch:'execution',selectedTaskId:'task',
    hypothesisCount:3,counterexampleChecks:10,regressionDepth:3,
    independentEvidenceSources:5,learningOutputs:5,
    proofClasses:['IDENTITY','CONSTRAINTS','CAUSALITY','FALSIFICATION','REGRESSION'],
    preExecution25:{status:'PASS',operationCount:30,operationDigest:'e'.repeat(64)},
    adversarialReview:{status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',counterexampleFound:false},
  })
};
const patchBase={
  targetSha:sha,failureFingerprint:fp,
  diagnosis:{diagnosisQuality:'strong',causalConfidence:0.92,ambiguity:false,directFailureSignal:true,rootCause:'example',location:{file:'src/example.ts'}},
  plan:{id:'example',file:'src/example.ts'},
  fileSelection:base.fileSelection,
  awareness:base.cognitiveAwareness,
  twin:{role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',targetSha:sha,failureFingerprint:fp,falsificationComplete:true,counterexampleFound:false},
  simulation:{status:'PASS',ok:true,scopeOk:true,behavioralVerification:{ok:true}},
  differential:{status:'PASS',scopeProof:true},
  regressionCounterexamples:{searchedCount:12,requiredSearches:12,exhausted:true,counterexampleFound:false},
  targetedRegression:{ok:true},
  primaryProof:verifier.primaryCorrectnessProof,
  scopeCheck:true,noTestMutation:true,noControlPlaneMutation:true,noMainMutation:true,noGateWeakening:true
};
function run(name,fn){
  try{return {name,passed:Boolean(fn()),error:null};}
  catch(error){return {name,passed:false,error:String(error?.message??error)};}
}

const runners=new Map([
 [1,()=>buildPatchCorrectnessProof({...patchBase,diagnosis:{...patchBase.diagnosis,causalConfidence:0.55,diagnosisQuality:'weak'}}).status==='BLOCK'],
 [2,()=>buildPatchCorrectnessProof({...patchBase,diagnosis:{...patchBase.diagnosis,ambiguity:true}}).status==='BLOCK'],
 [3,()=>buildPatchCorrectnessProof({...patchBase,fileSelection:{...patchBase.fileSelection,selectedFiles:[{path:'src/wrong.ts'}]}}).status==='BLOCK'],
 [4,()=>evaluateMutationGate({...base,mutationScope:{...base.mutationScope,gateWeakening:true}}).status==='BLOCK'],
 [5,()=>buildPatchCorrectnessProof({...patchBase,regressionCounterexamples:{searchedCount:12,requiredSearches:12,exhausted:false,counterexampleFound:true}}).status==='BLOCK'],
 [6,()=>evaluateMutationGate({...base,currentSha:'b'.repeat(40)}).status==='BLOCK'],
 [7,()=>evaluateMutationGate({...base,verifierProof:{...verifier,targetSha:'b'.repeat(40)}}).status==='BLOCK'],
 [8,()=>evaluateMutationGate({...base,cognitiveAwareness:{...base.cognitiveAwareness,awarenessCompleteness:{complete:false}}}).status==='BLOCK'],
 [9,()=>evaluateMutationGate({...base,falsificationReport:{...base.falsificationReport,counterexampleFound:true}}).status==='BLOCK'],
 [10,()=>evaluateMutationGate({...base,cognitiveAwareness:{...base.cognitiveAwareness,awarenessCompleteness:{complete:false}}}).status==='BLOCK'],
 [11,()=>evaluateMutationGate({...base,falsificationReport:{...base.falsificationReport,falsificationComplete:false}}).status==='BLOCK'],
 [12,()=>evaluateMutationGate({...base,falsificationReport:{...base.falsificationReport,counterexampleFound:true}}).status==='BLOCK'],
 [13,()=>evaluateMutationGate({...base,differentialProof:{status:'BLOCK',scopeProof:false}}).status==='BLOCK'],
 [14,()=>evaluateCertification({
   benchmarkScore:100,benchmarkVersion,exactSha:sha,executionSha:sha,canonicalGreenRecord:null,projectRedCount:0,
   globalChecks:Object.fromEntries(['allIntelligenceTestsPass','allSecurityTestsPass','allProofTestsPass','allFalsificationTestsPass','allSimulationTestsPass','allDifferentialTestsPass','allRegressionTestsPass','noSkippedTests','noContinueOnError','noWeakenedGate','noFalsePositive','noFalseGreen','noStaleProof','noUnresolvedCounterexample'].map(k=>[k,true]))
 }).certificationStatus==='NOT_CERTIFIED'],
 [15,()=>evaluateMutationGate({...base,mutationScope:{...base.mutationScope,controlPlaneMutation:true}}).status==='BLOCK']
]);

// Direct protocol checks ensure the benchmark rejects unsafe states even when sub-gates are bypassed.
const blockedCaseDefinitions=[
  ['invalid mutation recommendation',()=>validateActionVaultVerifierProof({proof:{...verifier,mutationRecommendation:'MAYBE'},targetSHA:sha,failureFingerprint:fp})],
  ['pre-mutation differential block',()=>validateActionVaultPreMutationProofs({
    sandboxProof:{protocol:'REPAIR-SANDBOX-SIMULATION-PROOF-v2',status:'PASS',ok:true,targetSha:sha,failureFingerprint:fp,exactShaBound:true,mutationPerformed:false,patchDigest:'x',regressionCounterexamples:{exhausted:true,counterexampleFound:false}},
    differentialProof:{protocol:'DIFFERENTIAL-REPAIR-PROOF-v1',status:'BLOCK',targetSha:sha,behavioralVerification:{ok:false},exactShaBound:true,scopeProof:false},
    patchCorrectnessProof:{protocol:'PATCH-CORRECTNESS-PROOF-v1',status:'BLOCK',targetSha:sha,failureFingerprint:fp,sourceMutationAllowed:false},
    targetSHA:sha,failureFingerprint:fp
  })],
  ['test-only mutation',()=>validateErrorOnlyMutation({failureLocation:'src/example.ts',selectedFile:'tests/example.spec.ts',changedPaths:['tests/example.spec.ts']})],
  ['diagnostic mutation admission',()=>assertAgentAdmission({actor:'diagnosticAgent',branch:'execution',mutation:true})],
  ['control-plane mutation',()=>{
    if(evaluateMutationGate({...base,mutationScope:{...base.mutationScope,controlPlaneMutation:true}}).status!=='BLOCK') throw new Error('CONTROL_PLANE_MUTATION_NOT_BLOCKED');
  }]
];
const blockedCases=blockedCaseDefinitions.map(([name,test])=>{
  try{assert.throws(test);return {name,blocked:true};}
  catch{return {name,blocked:false};}
});
assert.equal(blockedCases.length,5);
assert.equal(blockedCases.every(item=>item.blocked),true);
assert.equal(evaluateMutationGate({...base,fiveXEnvelope:null}).status,'BLOCK','FIVE_X_EXECUTION_READY');

const results=spec.cases.map(c=>{
  const result=run(c.name,()=>runners.get(c.id)());
  return {...c,...result,status:result.passed?'PASS':'FAIL'};
});
const categoryResults={};
for(const [category,weight] of Object.entries(spec.categoryWeights)){
  const cases=results.filter(c=>Object.hasOwn(c.categories,category));
  const allocated=cases.reduce((n,c)=>n+Number(c.categories[category]||0),0);
  const earned=cases.reduce((n,c)=>n+(c.passed?Number(c.categories[category]||0):0),0);
  categoryResults[category]={weight:Number(weight),allocated,earned,passed:allocated===Number(weight)&&earned===allocated};
}
const score=Number(Object.values(categoryResults).reduce((n,c)=>n+c.earned,0).toFixed(2));
const report={
 schemaVersion:1,benchmarkVersion,cases:results,categoryResults,
 gateIntegrityAdversarial:GATE_INTEGRITY_ADVERSARIAL,
 blockedCases,
 gateIntegrityPass:blockedCases.length===5 && blockedCases.every(item=>item.blocked),
 weightTotal:Object.values(spec.categoryWeights).reduce((n,v)=>n+Number(v),0),
 score,allCasesPass:results.every(c=>c.passed),allCategoriesPass:Object.values(categoryResults).every(c=>c.passed),
 noSkippedTests:true,generatedAt:new Date().toISOString()
};
fs.writeFileSync('/tmp/action-vault-intelligence-benchmark.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.allCasesPass||!report.allCategoriesPass||score!==100||!report.gateIntegrityPass)process.exit(1);
