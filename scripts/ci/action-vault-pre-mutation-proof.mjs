#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { planRepair } from './auto-repair/planner.mjs';
import { resolveTargetedTests } from './auto-repair/reproduction.mjs';
import { verifyTargetIdentity, reproduceStable } from './auto-repair/verification.mjs';
import { reproduce } from './auto-repair/reproduction.mjs';
import { simulateAstRepair } from './action-repair-sandbox.mjs';
import { searchRegressionCounterexamples } from './regression-counterexamples.mjs';
import { buildPatchCorrectnessProof } from './patch-correctness-proof.mjs';

const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
const output=arg('output','/tmp/action-vault-pre-mutation-proof.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const runId=arg('run-id','');
const logPath=arg('log','');
const diagnosisPath=arg('diagnosis','');
const strategyPath=arg('strategy','');
const fileSelectionPath=arg('file-selection','');
const awarenessPath=arg('awareness','');
const twinPath=arg('twin','');
const primaryProofPath=arg('primary-proof','');
const rootCauseProofPath=arg('root-cause','');

const shaOk=(v)=>/^[a-f0-9]{40}$/.test(String(v??''));
if(!shaOk(targetSha)||!fingerprint||!runId)throw new Error('PRE_MUTATION_IDENTITY_REQUIRED');
const git=(args,cwd=process.cwd())=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const currentSha=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
if(branch!=='execution')throw new Error('PRE_MUTATION_BRANCH_INVALID');

const readJson=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const failureLog=fs.readFileSync(logPath,'utf8');
const diagnosis=readJson(diagnosisPath);
const strategy=readJson(strategyPath);
const selection=readJson(fileSelectionPath);
const awareness=readJson(awarenessPath);
const twin=readJson(twinPath);
const primaryProof=readJson(primaryProofPath);
const rootCauseProof=readJson(rootCauseProofPath);

const failures=[];
if(currentSha!==targetSha)failures.push('EXACT_SHA_MISMATCH');
if(diagnosis.failureFingerprint&&diagnosis.failureFingerprint!==fingerprint)failures.push('DIAGNOSIS_FINGERPRINT_MISMATCH');
if(selection.targetSha!==targetSha||selection.failureFingerprint!==fingerprint||selection.decision!=='SELECTED')failures.push('FILE_SELECTION_IDENTITY_INVALID');
if(awareness.targetSha!==targetSha||awareness.failureFingerprint!==fingerprint||awareness.awarenessCompleteness?.complete!==true)failures.push('COGNITIVE_AWARENESS_INVALID');
if(twin.targetSha!==targetSha||twin.failureFingerprint!==fingerprint||twin.falsificationComplete!==true||twin.counterexampleFound!==false)failures.push('TWIN_FALSIFICATION_INVALID');
if(primaryProof.targetSha!==targetSha||primaryProof.failureFingerprint!==fingerprint||primaryProof.status!=='PRIMARY_CORRECTNESS_PROVEN')failures.push('PRIMARY_CORRECTNESS_INVALID');

const features=(diagnosis.features||[]);
const targeted=resolveTargetedTests(failureLog,features,{targetDir:process.cwd()});
const targetIdentity=verifyTargetIdentity(process.cwd(),targeted);
if(!targeted.exact||!targetIdentity.ok) failures.push('TARGET_VERIFICATION_NOT_EXACT');

const baseline=reproduceStable(process.cwd(),targeted.commands,reproduce,{attempts:3});
if(baseline.classification!=='REPRODUCIBLE_FAILURE') failures.push('BASELINE_NOT_STABLE_FAILURE');

const memory={cases:[],lessons:[],antiLessons:[],playbooks:[],actionHistory:[]};
const plan=planRepair(failureLog,{historical:[],memory});
const preferred=String(strategy.strategyId||strategy.selected?.id||'');
const selected=plan.candidates.find(c=>c.id===preferred && c.mutate===true) || (plan.selected?.mutate===true?plan.selected:null);
if(!selected) failures.push('NO_MUTABLE_STRATEGY_MATCH');
if(selected?.file && selection.selectedFiles?.every(x=>x.path!==selected.file) && selected.id!=='prepared-source-change') failures.push('STRATEGY_FILE_OUTSIDE_SELECTION');

let simulation=null;
if(!failures.length){
  simulation=simulateAstRepair({
    repoRoot:process.cwd(),
    taskId:'ACTION-RED:'+runId+':'+fingerprint,
    fingerprint,
    targetSha,
    selected,
    checks:targeted.commands,
    failureLog,
  });
  if(simulation.status!=='PASS' || simulation.ok!==true) failures.push('SANDBOX_SIMULATION_FAILED');
}

const differential=simulation?.differentialProof??{status:'BLOCK',scopeProof:false};
if(differential.status!=='PASS') failures.push('DIFFERENTIAL_VERIFICATION_FAILED');

const regressionCounterexamples=searchRegressionCounterexamples({
  targetSha,
  failureFingerprint:fingerprint,
  selectedFiles:selection.selectedFiles?.map(x=>x.path)??[],
  relatedFiles:[...(simulation?.changedFiles??[])],
  diff:simulation?.candidateDiff??'',
  sourceFiles:{...(simulation?.candidateFiles??{}),...(simulation?.baseFiles??{})},
  failureLog,
});
if(!regressionCounterexamples.exhausted) failures.push('REGRESSION_COUNTEREXAMPLES_NOT_EXHAUSTED');

const patchCorrectness=buildPatchCorrectnessProof({
  targetSha,
  failureFingerprint:fingerprint,
  diagnosis:{
    ...diagnosis,
    directFailureSignal:diagnosis.directFailureSignal!==false,
    diagnosisQuality:diagnosis.diagnosisQuality||'strong',
  },
  plan:selected,
  fileSelection:selection,
  awareness,
  twin,
  simulation,
  differential,
  regressionCounterexamples,
  targetedRegression:{
    ok:simulation?.behavioralVerification?.ok===true,
  },
  primaryProof,
  rootCauseProof,
  scopeCheck:simulation?.scopeOk===true,
  noTestMutation:!(simulation?.changedFiles||[]).some(f=>/(^|\/)(?:tests?|__tests__)\//u.test(f)),
  noControlPlaneMutation:!(simulation?.changedFiles||[]).some(f=>/^scripts\/ci\/|^\.github\/workflows\//u.test(f)),
  noMainMutation:true,
  noGateWeakening:!/(continue-on-error|test\.(?:skip|only)|describe\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck))/i.test(simulation?.candidateDiff||''),
});
if(patchCorrectness.status!=='PROVEN') failures.push(...patchCorrectness.remainingRisks);

const proofCompleteness={
 EXACT_SHA:currentSha===targetSha,
 FAILURE_FINGERPRINT:Boolean(fingerprint),
 COGNITIVE_AWARENESS_PROVEN:awareness.awarenessCompleteness?.complete===true,
 CAUSAL_EVIDENCE_GRAPH_PROVEN:rootCauseProof.status==='PROVEN',
 ROOT_CAUSE_PROVEN:patchCorrectness.proofCompleteness?.ROOT_CAUSE_PROVEN===true,
 FILE_SELECTION_PROVEN:patchCorrectness.proofCompleteness?.PATCH_TARGET_PROVEN===true,
 PROGRAMMER_TWIN_PARITY_PROVEN:patchCorrectness.proofCompleteness?.PROGRAMMER_TWIN_PARITY_PROVEN===true,
 ADVERSARIAL_FALSIFICATION_COMPLETE:twin.falsificationComplete===true,
 NO_VALID_COUNTEREXAMPLE:patchCorrectness.proofCompleteness?.NO_VALID_COUNTEREXAMPLE===true,
 SANDBOX_SIMULATION_PASSED:simulation?.ok===true,
 DIFFERENTIAL_CHECK_PASSED:differential.status==='PASS',
 PATCH_CORRECTNESS_PROVEN:patchCorrectness.status==='PROVEN',
 REGRESSION_COUNTEREXAMPLES_EXHAUSTED:regressionCounterexamples.exhausted===true,
 NO_SCOPE_VIOLATION:patchCorrectness.proofCompleteness?.NO_SCOPE_VIOLATION===true,
 NO_TEST_MUTATION:patchCorrectness.proofCompleteness?.NO_TEST_MUTATION===true,
 NO_CONTROL_PLANE_MUTATION:patchCorrectness.proofCompleteness?.NO_CONTROL_PLANE_MUTATION===true,
 NO_MAIN_MUTATION:true,
 NO_GATE_WEAKENING:patchCorrectness.proofCompleteness?.NO_GATE_WEAKENING===true,
};
const allComplete=Object.values(proofCompleteness).every(Boolean)&&failures.length===0;
const report={
 schemaVersion:1,
 protocol:'REPAIR-SIMULATION-PROOF-v1',
 status:allComplete?'PROVEN':'BLOCK',
 targetSha,failureFingerprint:fingerprint,failedRunId:runId,
 entryState:{sha:targetSha,branch:'execution',baselineClassification:baseline.classification,baselineAttempts:baseline.attempts},
 selectedStrategy:selected?.id??null,
 targetSelection:targeted,
 targetIdentity,
 diagnosis,
 primaryCorrectnessProof:primaryProof,
 rootCauseProof,
 cognitiveAwareness:{protocol:awareness.protocol,complete:awareness.awarenessCompleteness?.complete===true},
 programmerTwin:{protocol:twin.protocol,status:twin.status,falsificationComplete:twin.falsificationComplete,counterexampleFound:twin.counterexampleFound,falsificationSearches:twin.falsificationSearches||[]},
 sandboxSimulation:simulation,
 differentialProof:differential,
 regressionCounterexamples,
 patchCorrectness,
 proofCompleteness,
 noMutationApplied:true,
 remainingRisks:failures,
 generatedAt:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,targetSha,failureFingerprint:fingerprint,selectedStrategy:report.selectedStrategy,baseline:baseline.classification,simulation:simulation?.reason??null,differential:differential.status,regressionCounterexamples:regressionCounterexamples.status,patchCorrectness:patchCorrectness.status,failures:failures.length},null,2));
if(report.status!=='PROVEN')process.exitCode=1;
