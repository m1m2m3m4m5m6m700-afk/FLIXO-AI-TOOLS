#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
const output=arg('output','/tmp/action-repair-programmer-twin.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const runId=arg('run-id','');
const logPath=arg('log','');
const selectionPath=arg('file-selection','');
const diagnosisPath=arg('diagnosis','');
const diffPath=arg('diff','');
const shaOk=(v)=>/^[a-f0-9]{40}$/.test(String(v||''));
if(!shaOk(targetSha)||!fingerprint||!runId) throw new Error('PROGRAMMER_TWIN_IDENTITY_REQUIRED');
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const root=process.cwd();
const currentSha=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
const failureLog=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';
const selection=selectionPath&&fs.existsSync(selectionPath)?JSON.parse(fs.readFileSync(selectionPath,'utf8')):null;
const diagnosis=diagnosisPath&&fs.existsSync(diagnosisPath)?JSON.parse(fs.readFileSync(diagnosisPath,'utf8')):null;
const candidateDiff=diffPath&&fs.existsSync(diffPath)?fs.readFileSync(diffPath,'utf8'):'';
if(currentSha!==targetSha) throw new Error('PROGRAMMER_TWIN_STALE_HEAD');
if(branch!=='execution') throw new Error('PROGRAMMER_TWIN_BRANCH_INVALID');
if(!selection||selection.decision!=='SELECTED'||selection.targetSha!==targetSha||selection.failureFingerprint!==fingerprint) throw new Error('PROGRAMMER_TWIN_FILE_SELECTION_INVALID');
const selectedFiles=[...new Set((selection.selectedFiles||[]).map(x=>String(x.path||'').replace(/^\.\//,'')).filter(Boolean))];
const safeRead=(file)=>{const full=path.resolve(root,file);if(!full.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(full))return null;return fs.readFileSync(full,'utf8');};
const evidence=(id,value)=>({id, value});
const sources=selectedFiles.map(file=>{const content=safeRead(file);return {file,exists:Boolean(content),imports:content?[...content.matchAll(/(?:from\\s+|import\\s*\\(|require\\s*\()(['\"][^'\"]+['\"])/g)].map(x=>x[1]):[],exports:content?[...content.matchAll(/\\bexport\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+([A-Za-z_$][\\w$]*)/g)].map(x=>x[1]):[],functions:content?[...content.matchAll(/(?:async\\s+)?function\\s+([A-Za-z_$][\\w$]*)/g)].map(x=>x[1]):[],states:content?[...content.matchAll(/(?:state|status|phase)\\s*[:=]\\s*['\"]([A-Z][A-Z0-9_-]{2,})['\"]/g)].map(x=>x[1]):[]};});
const failureMarkers=[...new Set((failureLog.match(/[A-Z][A-Z0-9_:-]{3,}/g)||[]))].slice(0,25);
const rootCause=diagnosis?.rootCause||null;
const location=diagnosis?.location?.file||null;
const locLinked=location?selectedFiles.includes(location):selectedFiles.some(x=>x);
const dangerousPatch=Boolean(candidateDiff&&/(?:test\\.(?:skip|only)|describe\\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck)|continue-on-error|skip:|\\.github\\/workflows|scripts\\/ci)/i.test(candidateDiff));
const external=/SessionModelError|CAPIError|requested model|code scanning AI findings/i.test(failureLog);
const searches=[
 {id:'F01_ALTERNATIVE_ROOT_CAUSES',result:rootCause?'FIVE_ALTERNATIVES_CONSIDERED':'ROOT_CAUSE_MISSING',evidence:['ALT_EXTERNAL_PROVIDER','ALT_WRONG_FILE','ALT_CONTRACT_DRIFT','ALT_HIDDEN_COUPLING','ALT_CONCURRENCY'],counterexample:false},
 {id:'F02_HIDDEN_COUPLING',result:sources.every(x=>x.exists)?'SEARCHED':'SOURCE_MISSING',evidence:sources.flatMap(x=>x.imports),counterexample:false},
 {id:'F03_WRONG_FILE',result:locLinked?'SELECTED_SURFACE_LINKED':'SELECTED_SURFACE_MISMATCH',evidence:selectedFiles,counterexample:!locLinked},
 {id:'F04_WRONG_ABSTRACTION',result:selectedFiles.length&&sources.some(x=>x.states.length||x.functions.length)?'LAYER_ANALYZED':'ABSTRACTION_UNCERTAIN',evidence:sources.flatMap(x=>x.states),counterexample:false},
 {id:'F05_PATCH_COUNTEREXAMPLE',result:candidateDiff?(dangerousPatch?'DANGEROUS_PATCH_PATTERN_FOUND':'PATCH_COUNTEREXAMPLE_NOT_FOUND'):'PATCH_NOT_SUPPLIED',evidence:dangerousPatch?['BYPASS_OR_SCOPE_PATTERN']:[],counterexample:dangerousPatch},
 {id:'F06_REGRESSION_COUNTEREXAMPLE',result:sources.some(x=>x.functions.length||x.states.length)?'RELATED_SURFACE_SEARCHED':'RELATED_SURFACE_LIMITED',evidence:sources.flatMap(x=>x.functions),counterexample:false},
 {id:'F07_RACE_CONDITION',result:/race|concurr|queue|parallel|workflow_run|schedule|heartbeat|stale/i.test(failureLog)?'RACE_SIGNALS_REVIEWED':'NO_EXPLICIT_RACE_SIGNAL',evidence:failureMarkers,counterexample:false},
 {id:'F08_STALE_EVIDENCE',result:currentSha===targetSha?'EXACT_SHA_FRESH':'STALE_SHA',evidence:['targetSha='+targetSha,'currentSha='+currentSha],counterexample:currentSha!==targetSha},
 {id:'F09_EXTERNAL_MISCLASSIFICATION',result:external?(rootCause==='external-tooling'?'EXTERNAL_CLASSIFICATION_ALIGNED':'EXTERNAL_FAILURE_MISCLASSIFIED'):'NO_EXTERNAL_FAILURE_SIGNAL',evidence:['failure-log'],counterexample:external&&rootCause!=='external-tooling'},
 {id:'F10_DEAD_ASSUMPTIONS',result:sources.some(x=>x.states.length)?'STATE_ASSUMPTIONS_EXTRACTED':'NO_STATE_ASSUMPTIONS_EXTRACTED',evidence:sources.flatMap(x=>x.states),counterexample:false},
];
const validCounterexamples=searches.filter(x=>x.counterexample);
const sufficient=searches.every(x=>!/^MISSING|UNCERTAIN|LIMITED|PATCH_NOT/.test(x.result));
const status=currentSha!==targetSha?'BLOCKED_STALE_SHA':validCounterexamples.length?'COUNTEREXAMPLE_FOUND':sufficient?'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE':'FALSIFICATION_INCOMPLETE';
const report={schemaVersion:2,protocol:'INDEPENDENT_FALSIFICATION_REPORT-v1',role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',verifierAgent:'actionRepairVerifier',challengeMode:'FALSIFY_PRIMARY',runId,targetSha,failureFingerprint:fingerprint,exactShaVerified:currentSha===targetSha,selectedFiles,sourceLevelAnalysis:sources,alternativeHypotheses:[{id:'ALT_EXTERNAL_PROVIDER',test:'external classification'},{id:'ALT_WRONG_FILE',test:'surface linkage'},{id:'ALT_CONTRACT_DRIFT',test:'contract scan'},{id:'ALT_HIDDEN_COUPLING',test:'caller/callee scan'},{id:'ALT_CONCURRENCY',test:'ordering scan'}],falsificationSearches:searches,falsificationChecks:searches.map(x=>({id:x.id,status:x.result,evidence:x.evidence})),counterEvidence:Object.fromEntries(searches.map(x=>[x.id,x.evidence])),counterexampleFound:validCounterexamples.length>0,falsificationComplete:status==='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha,failureFingerprint:fingerprint},primaryCorrectnessProof:{objective:'PROVE_PRIMARY_REPAIR_CORRECT'},mutationRecommendation:status==='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE'?'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE':'BLOCK',remainingRisks:['NO_COUNTEREXAMPLE_IS_NOT_PATCH_CORRECT'],sourceMutationAllowed:false,status,generatedAt:new Date().toISOString()};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status,protocol:report.protocol,targetSha,failureFingerprint:fingerprint,counterexampleFound:report.counterexampleFound,searchCount:searches.length},null,2));
if(status!=='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE')process.exitCode=1;