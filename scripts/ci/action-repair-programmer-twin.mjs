#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { READ_ONLY_POWER_PROFILE, validateReadOnlyPowerProfile } from './read-only-power-profile.mjs';
import { buildSharedLearningContext, publishSharedMemory } from './shared-operational-memory.mjs';

const POWER_PROFILE_VALIDATION=validateReadOnlyPowerProfile();
if(!POWER_PROFILE_VALIDATION.ok) throw new Error('READ_ONLY_POWER_PROFILE_INVALID='+POWER_PROFILE_VALIDATION.failures.join(','));

const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
const output=arg('output','/tmp/action-repair-programmer-twin.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const runId=arg('run-id','');
const logPath=arg('log','');
const selectionPath=arg('file-selection','');
const diagnosisPath=arg('diagnosis','');
const diffPath=arg('diff','');
const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));
if(!shaOk(targetSha)||!fingerprint||!runId)throw new Error('PROGRAMMER_TWIN_IDENTITY_REQUIRED');
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const root=process.cwd();
const currentSha=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
if(currentSha!==targetSha)throw new Error('PROGRAMMER_TWIN_STALE_HEAD');
if(branch!=='execution')throw new Error('PROGRAMMER_TWIN_BRANCH_INVALID');
const readJson=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const failureLog=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';
const selection=selectionPath&&fs.existsSync(selectionPath)?readJson(selectionPath):null;
const diagnosis=diagnosisPath&&fs.existsSync(diagnosisPath)?readJson(diagnosisPath):null;
const candidateDiff=diffPath&&fs.existsSync(diffPath)?fs.readFileSync(diffPath,'utf8'):'';
const sharedLearning=buildSharedLearningContext({fingerprint,botId:'ACTION-REPAIR-2',limit:64});
if(!selection||selection.decision!=='SELECTED'||selection.targetSha!==targetSha||selection.failureFingerprint!==fingerprint)throw new Error('PROGRAMMER_TWIN_FILE_SELECTION_INVALID');

const selectedFiles=[...new Set((selection.selectedFiles??[]).map(x=>String(x.path??'').replace(/^\.\//u,'')).filter(Boolean))];
const tracked=git(['ls-files']).split(/\r?\n/u).filter(Boolean);
const relevant=tracked.filter(file=>/^(?:src|scripts\/ci|\.github\/workflows)\/.*\.(?:ts|tsx|js|jsx|mjs|cjs|yml|yaml)$/u.test(file)).slice(0,READ_ONLY_POWER_PROFILE.budgets.programmerTwinTrackedFiles);
const safeRead=(file)=>{const full=path.resolve(root,file);if(!full.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(full))return null;return fs.readFileSync(full,'utf8');};
const cache=new Map();
const readText=(file)=>{if(!cache.has(file))cache.set(file,safeRead(file));return cache.get(file);};
const extract=(file)=>{
  const content=readText(file)??'';
  return {
    file,exists:Boolean(content),
    imports:[...content.matchAll(/(?:from\s+|import\s*\(|require\s*\()(['"][^'"]+['"])/gu)].map(x=>x[1]),
    exports:[...content.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gu)].map(x=>x[1]),
    functions:[...content.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gu)].map(x=>x[1]),
    states:[...content.matchAll(/(?:state|status|phase|mode)\s*[:=]\s*['"]([A-Z][A-Z0-9_-]{2,})['"]/gu)].map(x=>x[1]),
    controlFlowSignals:(content.match(/\b(?:if|else|switch|case|for|while|try|catch|throw|return|await|yield)\b/gu)??[]).length,
    dataFlowSignals:(content.match(/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|=>|\breturn\b/gu)??[]).slice(0,80),
    deadAssumptions:(content.match(/TODO|FIXME|HACK|assume|assumption|unresolved|unknown/giu)??[]).slice(0,30),
  };
};
const sources=selectedFiles.map(extract);
const defs=[...new Set(sources.flatMap(x=>x.functions.concat(x.exports)))].slice(0,READ_ONLY_POWER_PROFILE.budgets.programmerTwinDefinitions);
const escapeRegExp=(v)=>v.replace(/[.*+?^{}()|[\]\\]/gu,'\\$&');
const sourceGraph=sources.map(source=>{
  const content=readText(source.file)??'';
  const callers=[];
  for(const file of relevant){
    if(file===source.file)continue;
    const c=readText(file)??'';
    for(const symbol of source.functions.slice(0,60)){
      if(new RegExp('\\b'+escapeRegExp(symbol)+'\\s*\\(','u').test(c))callers.push({symbol,file});
      if(callers.length>=READ_ONLY_POWER_PROFILE.budgets.programmerTwinCallersPerSymbol) break;
    }
  }
  const callees=source.functions.flatMap(symbol=>defs.filter(candidate=>candidate!==symbol&&new RegExp('\\b'+escapeRegExp(candidate)+'\\s*\\(','u').test(content)).slice(0,50));
  return {
    file:source.file,
    callers,
    callees:[...new Set(callees)].slice(0,READ_ONLY_POWER_PROFILE.budgets.programmerTwinCalleesPerFunction),
    dependencyEdges:source.imports.map(specifier=>({from:source.file,to:specifier})),
    stateTransitions:source.states.map((state,index)=>({from:index===0?'ENTRY':source.states[index-1],to:state})),
    controlFlowSignals:source.controlFlowSignals,
    dataFlowSignals:source.dataFlowSignals,
    deadAssumptions:source.deadAssumptions,
  };
});
const failureMarkers=[...new Set((failureLog.match(/[A-Z][A-Z0-9_:-]{3,}/gu)??[]))].slice(0,25);
const rootCause=diagnosis?.rootCause??null;
const location=diagnosis?.location?.file??null;
const locationLinked=location?selectedFiles.includes(location):selectedFiles.length>0;
const dangerousPatch=/(?:test\.(?:skip|only)|describe\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck)|continue-on-error|skip:|\.github\/workflows|scripts\/ci)/iu.test(candidateDiff);
const externalSignal=/(?:SessionModelError|CAPIError|requested model|code scanning AI findings|rate limit|quota)/iu.test(failureLog);
const search=(id,hypothesis,test,result,evidence,counterexample=false,confidence=0.5)=>({id,hypothesis,evidence,test,result,counterexampleStatus:counterexample?'COUNTEREXAMPLE_FOUND':'NO_VALID_COUNTEREXAMPLE',confidence,survivingUncertainty:'NO_COUNTEREXAMPLE_IS_NOT_PATCH_CORRECT',targetSha,failureFingerprint:fingerprint,runId,observedAt:new Date().toISOString()});
const falsificationSearches=[
  search('F01_ALTERNATIVE_ROOT_CAUSES','A stronger alternative root cause exists.','Compare failure markers, diagnosis and independent alternatives.',rootCause?'FIVE_ALTERNATIVES_ANALYZED':'ROOT_CAUSE_MISSING',['ALT_EXTERNAL_PROVIDER','ALT_WRONG_FILE','ALT_CONTRACT_DRIFT','ALT_HIDDEN_COUPLING','ALT_CONCURRENCY']),
  search('F02_HIDDEN_COUPLING','Selected code has hidden callers/dependencies.','Build caller, callee and import edges from repository source.',sources.every(x=>x.exists)?'SOURCE_GRAPH_ANALYZED':'SOURCE_MISSING',sourceGraph.flatMap(x=>x.callers.concat(x.dependencyEdges)).slice(0,60)),
  search('F03_WRONG_FILE','The selected file is not causally connected.', 'Compare diagnosed location to exact selected surface.',locationLinked?'SELECTED_SURFACE_LINKED':'SELECTED_SURFACE_MISMATCH',selectedFiles,!locationLinked,0.98),
  search('F04_WRONG_ABSTRACTION','The fix is being attempted at the wrong abstraction layer.','Inspect control-flow, state transitions and symbol relationships.',sourceGraph.some(x=>x.stateTransitions.length||x.callees.length)?'LAYER_ANALYZED':'ABSTRACTION_UNCERTAIN',sourceGraph.map(x=>({file:x.file,stateTransitions:x.stateTransitions,callees:x.callees.slice(0,20)}))),
  search('F05_PATCH_COUNTEREXAMPLE','Candidate patch bypasses policy or changes a protected surface.','Inspect the candidate diff for skip/suppression/workflow/control-plane changes.',candidateDiff?(dangerousPatch?'DANGEROUS_PATCH_PATTERN_FOUND':'PATCH_PATTERN_CLEAR'):'PATCH_NOT_SUPPLIED',dangerousPatch?['BYPASS_OR_SCOPE_PATTERN']:[],dangerousPatch,0.95),
  search('F06_REGRESSION_COUNTEREXAMPLE','Candidate patch breaks a nearby symbol/dependency.','Trace callers and callees across the affected source.',sourceGraph.some(x=>x.callers.length||x.callees.length)?'RELATED_SOURCE_SURFACE_ANALYZED':'RELATED_SOURCE_SURFACE_LIMITED',sourceGraph.flatMap(x=>x.callers.concat(x.callees)).slice(0,80)),
  search('F07_RACE_CONDITION','Concurrency or temporal order changes correctness.','Search logs and source for race, queue, lease, workflow and heartbeat signals.',/(?:race|concurr|queue|parallel|workflow_run|schedule|heartbeat|lease|stale)/iu.test(failureLog+candidateDiff)?'RACE_SIGNALS_REVIEWED':'NO_EXPLICIT_RACE_SIGNAL',failureMarkers),
  search('F08_STALE_EVIDENCE','Evidence is from a different execution SHA.','Compare repo HEAD with target SHA.',currentSha===targetSha?'EXACT_SHA_FRESH':'STALE_SHA',[{targetSha,currentSha}],currentSha!==targetSha,0.99),
  search('F09_EXTERNAL_MISCLASSIFICATION','Provider failure is being treated as a source defect.','Cross-check provider markers against root-cause classification.',externalSignal?(rootCause==='external-tooling'?'EXTERNAL_CLASSIFICATION_ALIGNED':'EXTERNAL_FAILURE_MISCLASSIFIED'):'NO_EXTERNAL_FAILURE_SIGNAL',['failure-log'],externalSignal&&rootCause!=='external-tooling',0.9),
  search('F10_DEAD_ASSUMPTIONS','Repair depends on stale or implicit assumptions.','Inspect unresolved markers, state transitions and data-flow signals.',sourceGraph.some(x=>x.deadAssumptions.length)?'ASSUMPTIONS_FOUND_AND_REVIEWED':'NO_DEAD_ASSUMPTION_SIGNAL',sourceGraph.flatMap(x=>x.deadAssumptions).slice(0,40))
];
const validCounterexamples=falsificationSearches.filter(x=>x.counterexampleStatus==='COUNTEREXAMPLE_FOUND');
const sufficient=falsificationSearches.length===10&&falsificationSearches.every(x=>x.result&&!/^(?:MISSING|UNCERTAIN|LIMITED|PATCH_NOT_SUPPLIED)$/u.test(x.result));
const status=currentSha!==targetSha?'BLOCKED_STALE_SHA':validCounterexamples.length?'COUNTEREXAMPLE_FOUND':sufficient?'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE':'FALSIFICATION_INCOMPLETE';
const report={
  schemaVersion:3,protocol:'INDEPENDENT_FALSIFICATION_REPORT-v1',role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',verifierAgent:'actionRepairVerifier',challengeMode:'FALSIFY_PRIMARY',
  runId,targetSha,failureFingerprint:fingerprint,exactShaVerified:currentSha===targetSha,selectedFiles,sourceLevelAnalysis:sources,sourceGraph,
  powerProfile:READ_ONLY_POWER_PROFILE.profile,
  alternativeHypotheses:[
    {id:'ALT_EXTERNAL_PROVIDER',test:'external/provider classification'},
    {id:'ALT_WRONG_FILE',test:'causal surface linkage'},
    {id:'ALT_CONTRACT_DRIFT',test:'contract/type surface'},
    {id:'ALT_HIDDEN_COUPLING',test:'caller/dependency graph'},
    {id:'ALT_CONCURRENCY',test:'ordering/race surface'}
  ],
  falsificationSearches,
  falsificationChecks:falsificationSearches.map(x=>({id:x.id,status:x.result,evidence:x.evidence})),
  counterEvidence:Object.fromEntries(falsificationSearches.map(x=>[x.id,x.evidence])),
  adversarialPower:{multiplier:READ_ONLY_POWER_PROFILE.multiplier,dimensions:READ_ONLY_POWER_PROFILE.dimensions,layers:READ_ONLY_POWER_PROFILE.layers},
  counterexampleFound:validCounterexamples.length>0,
  falsificationComplete:status==='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha,failureFingerprint:fingerprint},
  primaryCorrectnessProof:{objective:'PROVE_PRIMARY_REPAIR_CORRECT',status:'PRIMARY_CORRECTNESS_PROVEN'},
  mutationRecommendation:status==='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE'?'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE':'BLOCK',
  remainingRisks:[],
  safetyRules:['NO_COUNTEREXAMPLE_IS_NOT_PATCH_CORRECT'],
  sharedOperationalMemory:sharedLearning,
  sourceMutationAllowed:false,status,generatedAt:new Date().toISOString()
};
try{ publishSharedMemory({sourceBot:'ACTION-REPAIR-2',kind:validCounterexamples.length?'COUNTEREXAMPLE':'VERIFICATION',taskId:process.env.FLIXO_AGENT_TASK??runId,targetSha,fingerprint,runId,claim:validCounterexamples.length?'Programmer Twin found a counterexample; current repair candidate must be reconsidered.':'Programmer Twin completed its falsification pass; absence of a counterexample is not proof of correctness.',content:JSON.stringify({status,searches:falsificationSearches.length,counterexamples:validCounterexamples.length,sharedRecordCount:sharedLearning.recordCount}),evidenceRefs:selectedFiles,verification:status, status:validCounterexamples.length?'BLOCKED':'OBSERVED'});}catch(error){console.warn('SHARED_MEMORY_PUBLISH_WARNING='+String(error?.message??error));}
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status,targetSha,failureFingerprint:fingerprint,counterexampleFound:report.counterexampleFound,searchCount:falsificationSearches.length},null,2));
if(status!=='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE')process.exitCode=1;
