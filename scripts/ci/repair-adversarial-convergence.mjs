#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg=(name,fallback='')=>{const prefix='--'+name+'=';const hit=process.argv.find((v)=>v.startsWith(prefix));return hit?hit.slice(prefix.length):fallback;};
const readJson=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const output=arg('output','/tmp/flixo-adversarial-convergence.json');
const candidateSha=arg('candidate');
const failedSha=arg('failed');
const verificationPath=arg('verification','/tmp/flixo-candidate-verification.json');
const adversarialPath=arg('adversarial','/tmp/flixo-postpatch-adversarial.json');
const memoryPath=arg('memory','/tmp/flixo-repair-memory.json');
const attempt=Math.max(1,Number(arg('attempt','1'))||1);
const fingerprint=String(process.env.FLIXO_FAILURE_FINGERPRINT??'').trim();

const currentSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
if(branch!=='execution')throw new Error('ADVERSARIAL_CONVERGENCE_BRANCH_NOT_EXECUTION');
if(!/^[a-f0-9]{40}$/u.test(candidateSha)||candidateSha!==currentSha)throw new Error('ADVERSARIAL_CONVERGENCE_CANDIDATE_SHA_MISMATCH');
if(!/^[a-f0-9]{40}$/u.test(failedSha))throw new Error('ADVERSARIAL_CONVERGENCE_FAILED_SHA_INVALID');

const verification=readJson(verificationPath);
const adversarial=readJson(adversarialPath);
const verificationExact=verification?.targetSha===candidateSha;
const targetedPass=verification?.gate?.targetedRegression===true;
const adversarialPass=verification?.gate?.adversarialNoCounterexample===true&&adversarial?.counterexampleFound===false&&adversarial?.falsificationComplete===true;
const verificationPass=verification?.gate?.result==='PASS'&&targetedPass&&adversarialPass&&verification?.earlyAbort===false;
const counterexampleFound=adversarial?.counterexampleFound===true||adversarial?.falsifierVerdict==='REJECTED_WITH_COUNTER_EXAMPLE'||verification?.gate?.adversarialNoCounterexample===false;
const digest=(value)=>crypto.createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const nextStrategy=String(adversarial?.convergenceDirective?.nextStrategy??adversarial?.preferredAlternativeStrategy??adversarial?.challenge?.preferredAlternativeStrategy??'').trim()||null;
const nextRepair=String(adversarial?.convergenceDirective?.nextRepair??adversarial?.challenge?.preferredAlternativeRepair??'').trim()||null;

let status='FAIL_CLOSED_REQUEUE';
let nextAction='REPAIR_WITH_NEW_EVIDENCE';
if(verificationExact&&verificationPass){status='STABLE_FOR_PUBLICATION';nextAction='PROCEED_TO_INDEPENDENT_CHAIR_AUDIT_AND_GUARDED_PUBLICATION';}
else if(counterexampleFound){status='REPAIR_REQUEUE_REQUIRED';nextAction='INVALIDATE_CANDIDATE_RECORD_COUNTEREXAMPLE_RETRAIN_REPAIR_RETRY';}

if(counterexampleFound){
  const memory=readJson(memoryPath);
  memory.antiLessons=Array.isArray(memory.antiLessons)?memory.antiLessons:[];
  const candidateFingerprint=fingerprint||adversarial?.failureFingerprint||'unknown';
  const id=['ADVERSARIAL',candidateFingerprint,candidateSha.slice(0,12),String(attempt)].join(':');
  const lesson={id,fingerprint:candidateFingerprint,rootCause:'adversarial-falsification',rule:String(adversarial?.selectedStrategy??adversarial?.challenge?.preferredAlternativeStrategy??'UNKNOWN'),anti:true,repairAgent:'AUTO_REPAIR_BOT',candidateSha,failedSha,attempt,counterexampleFound:true,counterexampleEvidence:adversarial?.counterEvidence??adversarial?.falsificationEvidence??null,falsificationSearches:Array.isArray(adversarial?.falsificationSearches)?adversarial.falsificationSearches:[],nextStrategy,nextRepair,preventionRules:['ADVERSARIAL_COUNTEREXAMPLE_INVALIDATES_CANDIDATE','REQUIRE_NEW_EVIDENCE_BEFORE_REPAIR_RETRY','REQUIRE_ALTERNATIVE_STRATEGY_WHEN_AVAILABLE','NO_PUBLICATION_AFTER_FALSIFICATION'],createdAt:new Date().toISOString()};
  if(!memory.antiLessons.some((item)=>item?.id===id))memory.antiLessons.push(lesson);
  fs.writeFileSync(memoryPath,JSON.stringify(memory,null,2)+'\n');
}

const record={schemaVersion:1,protocol:'FLIXO-ADVERSARIAL-CONVERGENCE-v1',loop:'REPAIR ↔ ADVERSARIAL_CHALLENGE ↔ REPAIR',cycle:attempt,sourceSha:failedSha,candidateSha,currentSha,failureFingerprint:fingerprint||adversarial?.failureFingerprint||null,verificationExactSha:verificationExact,targetedRegression:targetedPass,adversarialFalsificationComplete:adversarial?.falsificationComplete===true,counterexampleFound,stable:status==='STABLE_FOR_PUBLICATION',status,nextAction,nextStrategy,nextRepair,pushEligible:status==='STABLE_FOR_PUBLICATION',pushAuthority:'GUARDED_CHAIR_PUBLICATION_ONLY',greenAuthority:'DAILY_FLIXO_GREEN_GATE',learning:{counterexampleRecorded:counterexampleFound,promotion:'ONLY_AFTER_CANONICAL_GREEN',antiLessonPath:counterexampleFound?memoryPath:null},evidenceDigest:digest({candidateSha,failedSha,verification,adversarial,status,nextStrategy,nextRepair}),generatedAt:new Date().toISOString()};
fs.mkdirSync(''.replace(/[^/]*$/,'' )||'.',{recursive:true});
fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));