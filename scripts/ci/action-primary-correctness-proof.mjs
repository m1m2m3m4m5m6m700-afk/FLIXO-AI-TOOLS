#!/usr/bin/env node
import fs from 'node:fs';

const arg=(name,fallback='')=>{
  const prefix='--'+name+'=';
  const hit=process.argv.find((value)=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):fallback;
};
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const output=arg('output','/tmp/action-primary-correctness-proof.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const taskId=arg('task','');
const runId=arg('run-id','');
const diagnosisPath=arg('diagnosis','');
const strategyPath=arg('strategy','');
const fileSelectionPath=arg('file-selection','');
const awarenessPath=arg('awareness','');

if(!/^[a-f0-9]{40}$/u.test(targetSha)) throw new Error('ACTION_PRIMARY_PROOF_SHA_REQUIRED');
if(!fingerprint||!taskId||!runId) throw new Error('ACTION_PRIMARY_PROOF_IDENTITY_REQUIRED');
if(!diagnosisPath||!strategyPath||!fileSelectionPath||!awarenessPath) throw new Error('ACTION_PRIMARY_PROOF_INPUT_REQUIRED');

const diagnosis=read(diagnosisPath);
const strategy=read(strategyPath);
const fileSelection=read(fileSelectionPath);
const awareness=read(awarenessPath);

if(awareness.protocol!=='ACTION-SYSTEM-COGNITIVE-AWARENESS-v1'||awareness.targetSha!==targetSha||awareness.failureFingerprint!==fingerprint||awareness.exactShaBound!==true||awareness.awarenessCompleteness?.complete!==true) throw new Error('ACTION_PRIMARY_PROOF_COGNITIVE_AWARENESS_INVALID');
if(fileSelection.targetSha!==targetSha||fileSelection.failureFingerprint!==fingerprint||fileSelection.decision!=='SELECTED') {
  throw new Error('ACTION_PRIMARY_PROOF_FILE_SELECTION_MISMATCH');
}
if(diagnosis.diagnosisQuality!=='strong'||Number(diagnosis.causalConfidence??0)<0.75||diagnosis.ambiguity===true||diagnosis.directFailureSignal!==true) {
  throw new Error('ACTION_PRIMARY_PROOF_DIAGNOSIS_NOT_PROVABLE');
}
if(!diagnosis.rootCause||!diagnosis.location?.file) throw new Error('ACTION_PRIMARY_PROOF_CAUSAL_LOCATION_REQUIRED');
const selectedPaths=fileSelection.selectedFiles.map((item)=>item.path);
if(!selectedPaths.includes(diagnosis.location.file)) throw new Error('ACTION_PRIMARY_PROOF_LOCATION_OUTSIDE_SELECTED_SURFACE');
if(!strategy.strategyId && !strategy.selected?.id) throw new Error('ACTION_PRIMARY_PROOF_STRATEGY_REQUIRED');

const proof={
  schemaVersion:1,
  protocol:'ACTION-PRIMARY-CORRECTNESS-PROOF-v1',
  role:'PRIMARY_CORRECTNESS_PROVER',
  agentId:'ACTION-REPAIR',
  status:'PRIMARY_CORRECTNESS_CLAIM',
  taskId,
  runId,
  targetSha,
  failureFingerprint:fingerprint,
  proofObjective:'PROVE_PRIMARY_REPAIR_CORRECT',
  proofClaims:[
    'ROOT_CAUSE_IS_SUPPORTED_BY_CURRENT_EXACT_SHA_EVIDENCE',
    'REPAIR_TARGET_IS_WITHIN_FILE_SELECTION_SCOPE',
    'REPAIR_CAN_BE_BOUNDED_TO_THE_DECLARED_STRATEGY',
    'VERIFICATION_OBLIGATIONS_ARE_EXPLICIT'
  ],
  cognitiveAwareness:{artifact:awarenessPath,protocol:awareness.protocol,domainCount:awareness.awarenessCompleteness.requiredDomains.length,systemWide:true},
  evidenceAnchors:{
    rootCause:diagnosis.rootCause,
    failureLocation:diagnosis.location.file,
    causalConfidence:Number(diagnosis.causalConfidence),
    diagnosisQuality:diagnosis.diagnosisQuality,
    directFailureSignal:diagnosis.directFailureSignal,
    strategyId:strategy.strategyId||strategy.selected?.id||null,
    selectedFiles:fileSelection.selectedFiles,
    excludedFiles:fileSelection.excludedFiles
  },
  obligationsForVerifier:[
    'ATTEMPT_TO_FIND_A_VALID_ALTERNATIVE_ROOT_CAUSE',
    'ATTEMPT_TO_FIND_A_SCOPE_VIOLATION',
    'ATTEMPT_TO_FIND_A_PATCH_COUNTEREXAMPLE',
    'ATTEMPT_TO_FIND_A_REGRESSION_COUNTEREXAMPLE'
  ],
  openRisks:Array.isArray(diagnosis.blastRadius)?diagnosis.blastRadius:[],
  sourceMutationAllowed:false,
  exactShaBound:true,
  generatedAt:new Date().toISOString()
};

fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({
  status:proof.status,
  role:proof.role,
  targetSha,
  fingerprint,
  obligationCount:proof.obligationsForVerifier.length
},null,2));
