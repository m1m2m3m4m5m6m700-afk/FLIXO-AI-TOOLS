#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {recordRedSignal,createLearningRequest,closeLearningRequest,recordVerifiedGreen,copyHistoricalIndexToActionIndexBot,requestMasterRepair} from './action-repair-memory.mjs';
import {recordRed,recordGreen} from './action-failure-ledger.mjs';

const ROOT=process.cwd();
const arg=(name,fallback='')=>{const p='--'+name+'=';const v=process.argv.find(x=>x.startsWith(p));return v?v.slice(p.length):fallback};
const op=arg('op','status');
const targetSha=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA);
const runId=arg('run-id',process.env.TARGET_RUN_ID);
const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT);
const solutionFile=arg('solution-file',process.env.FLIXO_SOLUTION_FILE);
const verification=arg('verification',process.env.FLIXO_VERIFICATION);
const evidenceRef=arg('evidence-ref',process.env.FLIXO_REPAIR_EVIDENCE_PATH);
const workflow=arg('workflow',process.env.FLIXO_FAILED_WORKFLOW);
const job=arg('job',process.env.FLIXO_FAILED_JOB);
const normalizedFailure=arg('normalized-failure',process.env.FLIXO_NORMALIZED_FAILURE);
const solution=solutionFile&&fs.existsSync(solutionFile)?JSON.parse(fs.readFileSync(solutionFile,'utf8')):null;

if(op==='sync-index'){
 const x=copyHistoricalIndexToActionIndexBot();
 console.log(JSON.stringify({master:'repairAgent',operation:op,status:'PASS',sourceRecordCount:x.historicalActionIndexMirror.sourceRecordCount},null,2));
 process.exit(0);
}
if(op==='open-red'){
 const x=recordRedSignal({fingerprint,runId,targetSha,workflow,job,normalizedFailure,rawFailure:process.env.FLIXO_FAILURE_LOG});
 recordRed({taskId:'ACTION-MASTER:'+runId+':'+String(fingerprint).slice(0,16),failureFingerprint:fingerprint,targetSha,failedRunId:runId,workflow,job,botId:'ACTION-HISTORIAN-3',notes:normalizedFailure});
 const y=createLearningRequest({fingerprint,runId,targetSha,workflow,job,normalizedFailure,master:'repairAgent',requiredFields:['rootCause','solution.strategyId','solution.rule','solution.changedPaths','verification','evidenceRef']});
 console.log(JSON.stringify({master:'repairAgent',operation:op,status:'OPEN_FOR_REPAIR_AND_LEARNING',signalId:x.redSignals.at(-1)?.signalId,requestId:y.learningRequests.at(-1)?.requestId},null,2));
 process.exit(0);
}
if(op==='request-master'){
 const evidenceFile=arg('evidence-file',process.env.FLIXO_ACTION_REPAIR_SEARCH_PATH||'');
 const evidence=evidenceFile&&fs.existsSync(evidenceFile)?JSON.parse(fs.readFileSync(evidenceFile,'utf8')):null;
 const selectedFile=arg('selected-file','');
 const attemptedStrategies=selectedFile&&fs.existsSync(selectedFile)?(JSON.parse(fs.readFileSync(selectedFile,'utf8')).selection?.ranked??[]).map(x=>x.strategyId).filter(Boolean):[];
 const x=requestMasterRepair({
   botId:arg('bot-id','ACTION-REPAIR'),
   taskId:arg('task-id','ACTION-MASTER:'+runId+':'+String(fingerprint).slice(0,16)),
   fingerprint,runId,targetSha,workflow,job,normalizedFailure,
   reason:arg('reason','NO_ACTIONABLE_INDEX_SOLUTION'),
   searchedIndex:arg('searched-index','docs/agents/historical-action-errors/index.json'),
   searchedTerms:evidence?.queryTerms??[],
   attemptedStrategies,
   rejectedStrategies:attemptedStrategies,
   evidenceGap:arg('evidence-gap','INDEX_AND_CURRENT_EVIDENCE_DID_NOT_PRODUCE_VERIFIED_ACTIONABLE_SOLUTION'),
   requestedPlan:arg('requested-plan','MASTER_REPAIR_ROOT_CAUSE_UPDATE_INDEX_ADD_NEW_PLAN'),
   proposedHypothesis:arg('proposed-hypothesis','')
 });
 console.log(JSON.stringify({master:'repairAgent',operation:op,status:'OPEN_MASTER_REQUIRED',requestId:x.learningRequests.find(r=>r.requestId)?.requestId??null},null,2));
 process.exit(0);
}
if(op==='close-green'){
 if(!solution) throw new Error('ACTION_MASTER_SOLUTION_FILE_REQUIRED');
 recordVerifiedGreen({fingerprint,runId,targetSha,solution,verification,evidenceRef});
 recordGreen({taskId:'ACTION-MASTER:'+runId+':'+String(fingerprint).slice(0,16),failureFingerprint:fingerprint,targetSha,failedRunId:runId,botId:'ACTION-HISTORIAN-3',notes:verification,evidence:[evidenceRef].filter(Boolean)});
 let y=null;
 try{y=closeLearningRequest({fingerprint,runId,targetSha,solution,verification,evidenceRef,master:'repairAgent'});}catch(error){if(error?.message!=='ACTION_LEARNING_REQUEST_NOT_FOUND')throw error}
 console.log(JSON.stringify({master:'repairAgent',operation:op,status:'GREEN_SOLUTION_LEARNED',requestClosed:Boolean(y),solution,verification},null,2));
 process.exit(0);
}
if(op==='request'){
 if(!fingerprint) throw new Error('ACTION_MASTER_REQUEST_FINGERPRINT_REQUIRED');
 const file=path.resolve(ROOT,'diagnostics/auto-repair/action-repair-bots/ACTION-INDEX.json');
 const x=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{learningRequests:[]};
 console.log(JSON.stringify({master:'repairAgent',openRequests:(x.learningRequests??[]).filter(r=>r.status==='OPEN')},null,2));
 process.exit(0);
}
throw new Error('ACTION_MASTER_UNKNOWN_OPERATION='+op);
