#!/usr/bin/env node
import fs from 'node:fs';
import { validateActionVaultVerifierProof } from './repair-protocol.mjs';

export const APPROVED_MUTATION_RECOMMENDATIONS=Object.freeze([
  'ALLOW',
  'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
]);

const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));

export function evaluateMutationGate({
  targetSha=null,
  currentSha=null,
  failureFingerprint=null,
  verifierProof=null,
  cognitiveAwareness=null,
  rootCauseProof=null,
  fileSelection=null,
  programmerTwinParity=null,
  falsificationReport=null,
  simulationProof=null,
  differentialProof=null,
  patchCorrectness=null,
  regressionCounterexamples=null,
  mutationScope={changedPaths:[],selectedFiles:[],testMutation:false,controlPlaneMutation:false,mainMutation:false,gateWeakening:false},
  branch='execution',
}={}){
  const failures=[];
  const checks={
    EXACT_SHA:shaOk(targetSha)&&shaOk(currentSha)&&targetSha===currentSha,
    FAILURE_FINGERPRINT:typeof failureFingerprint==='string'&&failureFingerprint.length>0,
    COGNITIVE_AWARENESS:Boolean(cognitiveAwareness?.protocol==='ACTION-SYSTEM-COGNITIVE-AWARENESS-v1'&&cognitiveAwareness?.targetSha===targetSha&&cognitiveAwareness?.failureFingerprint===failureFingerprint&&cognitiveAwareness?.awarenessCompleteness?.complete===true),
    ROOT_CAUSE_PROOF:Boolean(rootCauseProof?.status==='PROVEN'||rootCauseProof?.ok===true||rootCauseProof?.causalProof?.ok===true),
    FILE_SELECTION:Boolean(fileSelection?.decision==='SELECTED'&&fileSelection?.targetSha===targetSha&&fileSelection?.failureFingerprint===failureFingerprint&&Array.isArray(fileSelection?.selectedFiles)&&fileSelection.selectedFiles.length>0),
    PROGRAMMER_TWIN_PARITY:Boolean(programmerTwinParity?.intelligenceParity==='EXACT'&&programmerTwinParity?.authorityParity==='SEPARATED_BY_DESIGN'&&programmerTwinParity?.targetSha===targetSha&&programmerTwinParity?.failureFingerprint===failureFingerprint),
    ADVERSARIAL_FALSIFICATION_COMPLETE:Boolean(falsificationReport?.falsificationComplete===true&&falsificationReport?.counterexampleFound===false&&falsificationReport?.targetSha===targetSha&&falsificationReport?.failureFingerprint===failureFingerprint),
    NO_VALID_COUNTEREXAMPLE:Boolean(falsificationReport?.counterexampleFound===false&&falsificationReport?.falsificationComplete===true&&regressionCounterexamples?.counterexampleFound===false&&regressionCounterexamples?.exhausted===true),
    SANDBOX_SIMULATION:Boolean(simulationProof?.status==='PASS'||simulationProof?.ok===true||simulationProof?.status==='PROVEN'),
    DIFFERENTIAL_VERIFICATION:Boolean(differentialProof?.status==='PASS'),
    PATCH_CORRECTNESS:Boolean(patchCorrectness?.status==='PROVEN'&&patchCorrectness?.proofCompleteness?.PATCH_TARGET_PROVEN===true&&patchCorrectness?.proofCompleteness?.PATCH_MECHANISM_PROVEN===true),
    REGRESSION_COUNTEREXAMPLES_EXHAUSTED:Boolean(regressionCounterexamples?.exhausted===true),
    NO_SCOPE_VIOLATION:mutationScope.testMutation===false&&mutationScope.controlPlaneMutation===false&&mutationScope.mainMutation===false&&mutationScope.gateWeakening===false&&branch==='execution',
    NO_TEST_MUTATION:mutationScope.testMutation===false,
    NO_CONTROL_PLANE_MUTATION:mutationScope.controlPlaneMutation===false,
    NO_MAIN_MUTATION:mutationScope.mainMutation===false,
    NO_GATE_WEAKENING:mutationScope.gateWeakening===false,
  };
  for(const [key,ok] of Object.entries(checks)) if(!ok) failures.push(key);
  let normalizedVerifier=null;
  if(verifierProof){
    try{
      normalizedVerifier=validateActionVaultVerifierProof({proof:verifierProof,targetSHA:targetSha,failureFingerprint,verifierAgent:'actionRepairVerifier'});
    }catch(error){ failures.push('ACTION_VAULT_VERIFIER_PROOF:'+String(error?.message??error)); }
  } else {
    failures.push('ACTION_VAULT_VERIFIER_PROOF_MISSING');
  }
  const recommendation=verifierProof?.mutationRecommendation??null;
  if(!APPROVED_MUTATION_RECOMMENDATIONS.includes(recommendation)) failures.push('MUTATION_RECOMMENDATION_NOT_APPROVED');
  if(!Array.isArray(verifierProof?.remainingRisks)) failures.push('REMAINING_RISKS_REQUIRED');
  const proofCompleteness=verifierProof?.proofCompleteness??{};
  const requiredCompleteness=[
    'COGNITIVE_AWARENESS_PROVEN','ROOT_CAUSE_PROVEN','FILE_SELECTION_PROVEN',
    'PROGRAMMER_TWIN_PARITY_PROVEN','ADVERSARIAL_FALSIFICATION_COMPLETE','NO_VALID_COUNTEREXAMPLE',
    'SANDBOX_SIMULATION_PASSED','DIFFERENTIAL_CHECK_PASSED','PATCH_CORRECTNESS_PROVEN',
    'REGRESSION_COUNTEREXAMPLES_EXHAUSTED','NO_SCOPE_VIOLATION','NO_TEST_MUTATION',
    'NO_CONTROL_PLANE_MUTATION','NO_MAIN_MUTATION','NO_GATE_WEAKENING',
  ];
  for(const key of requiredCompleteness) if(proofCompleteness[key]!==true) failures.push('PROOF_COMPLETENESS:'+key);
  return Object.freeze({
    schemaVersion:1,
    protocol:'ACTION-VAULT-MUTATION-GATE-v1',
    status:failures.length?'BLOCK':'PASS',
    mutationAllowed:failures.length===0,
    recommendation,
    targetSha,
    currentSha,
    failureFingerprint,
    checks,
    proofCompleteness,
    normalizedVerifier,
    failures,
    rule:'MUTATION_BLOCKED_UNTIL_ALL_REQUIRED_PROOFS_PASS',
    generatedAt:new Date().toISOString(),
  });
}

if(process.argv[1]?.endsWith('action-vault-mutation-gate.mjs')&&process.argv[2]){
  const report=evaluateMutationGate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
  fs.writeFileSync(process.argv[3]??'/tmp/action-vault-mutation-gate.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='PASS')process.exitCode=1;
}
