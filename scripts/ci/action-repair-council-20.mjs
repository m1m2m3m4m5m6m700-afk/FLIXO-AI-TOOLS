#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):String(fallback)};
const mode=arg('mode','worker');
const workerId=arg('worker-id',process.env.ACTION_COUNCIL_WORKER_ID||'ACTION-COUNCIL-01');
const targetSha=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA||'');
const runId=arg('run-id',process.env.TARGET_RUN_ID||'');
const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT||'');
const memoryPath=arg('memory',process.env.FLIXO_ACTION_REPAIR_MEMORY||'diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR.json');
const inputDir=arg('input-dir','/tmp/flixo-action-council');
const output=arg('output',path.join(inputDir,workerId+'.json'));
const sha=v=>/^[a-f0-9]{40}$/iu.test(String(v||''));
if(!sha(targetSha)) throw new Error('ACTION_COUNCIL_TARGET_SHA_INVALID');
if(!runId) throw new Error('ACTION_COUNCIL_RUN_ID_REQUIRED');
const readJson=file=>JSON.parse(fs.readFileSync(path.resolve(ROOT,file),'utf8'));
const memory=readJson(memoryPath);
const registry=readJson('docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json');
if(memory.botId!=='ACTION-REPAIR') throw new Error('ACTION_COUNCIL_SOURCE_MEMORY_INVALID');
const council=registry.parallelCouncil;
if(!council || council.id!=='ACTION-COUNCIL-20' || council.workerCount!==20) throw new Error('ACTION_COUNCIL_REGISTRY_INVALID');

if(mode==='worker'){
 const worker=council.workers.find(w=>w.id===workerId);
 if(!worker) throw new Error('ACTION_COUNCIL_WORKER_INVALID');
 const specialization=worker.specialization;
 const corpus=memory.valuableKnowledge??{};
 const rules=Array.isArray(corpus.provenRules)?corpus.provenRules:[];
 const anti=Array.isArray(corpus.antiLessons)?corpus.antiLessons:[];
 const sourceSignal=memory.currentHistoricalActionSignals?.[0]??null;
 const candidateRule=rules[Math.abs(worker.index-1)%Math.max(1,rules.length)] || null;
 const strategyId=candidateRule?'ACTION-'+candidateRule:'ACTION-REPAIR-NEEDS-FRESH-HYPOTHESIS';
 const blocked=anti.some(a=>String(a).toLowerCase().includes('external provider')) && specialization==='EXTERNAL_PROVIDER';
 const result={schemaVersion:1,botId:workerId,kind:'ACTION_REPAIR_COUNCIL_WORKER',specialization,sourceKnowledgeBot:'ACTION-REPAIR',knowledgeSnapshotVersion:memory.schemaVersion,targetSha,runId,fingerprint,mutationAuthority:false,repositoryWrite:false,actionsWrite:false,evidence:{memorySources:Object.keys(memory.headquarters??{}),provenRuleCount:rules.length,antiLessonCount:anti.length,currentSignal:sourceSignal},proposal:{disposition:blocked?'REJECT':'CANDIDATE',strategyId,rule:candidateRule,exactTargetSha:targetSha,testMutation:false,needsCurrentReproduction:true,needsCanonicalGreen:true,rationale:'candidate derived from ACTION-REPAIR knowledge snapshot; specialization='+specialization,antiLessonConflict:blocked}};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',botId:workerId,specialization,strategyId,output},null,2));process.exit(0);
}
if(mode==='arbiter'){
 const files=fs.readdirSync(path.resolve(ROOT,inputDir)).filter(f=>/^ACTION-COUNCIL-\d{2}\.json$/u.test(f));
 if(files.length!==20) throw new Error('ACTION_COUNCIL_ARBITER_REQUIRES_20_RESULTS');
 const results=files.map(f=>readJson(path.join(inputDir,f)));
 if(results.some(x=>x.targetSha!==targetSha || x.runId!==runId || x.mutationAuthority!==false)) throw new Error('ACTION_COUNCIL_RESULT_IDENTITY_OR_AUTHORITY_INVALID');
 const counts=new Map();
 for(const x of results){const p=x.proposal??{};if(p.disposition!=='CANDIDATE'||!p.strategyId)continue;const item=counts.get(p.strategyId)??{strategyId:p.strategyId,count:0,workers:[],safe:true};item.count++;item.workers.push(x.botId);item.safe=item.safe&&p.exactTargetSha===targetSha&&p.testMutation===false&&p.antiLessonConflict!==true;counts.set(p.strategyId,item);}
 const ranked=[...counts.values()].sort((a,b)=>b.count-a.count||a.strategyId.localeCompare(b.strategyId));
 const winner=ranked[0]??null;
 const disposition=winner&&winner.count>=3&&winner.safe?'ACCEPT':'REJECT';
 const result={schemaVersion:1,botId:'ACTION-ARBITER',kind:'FINAL_REPAIR_PROPOSAL_ARBITER',targetSha,runId,fingerprint,workerCount:20,receivedCount:results.length,mutationAuthority:false,executionAuthority:'ACCEPT_OR_REJECT_PROPOSAL_ONLY',acceptanceRequires:{minimumIndependentConsensus:3,exactTargetSha:true,noTestMutation:true,noAntiLessonConflict:true,currentReproduction:true,canonicalGreen:true},decision:{disposition,acceptedStrategyId:disposition==='ACCEPT'?winner.strategyId:null,consensusCount:winner?.count??0,consensusWorkers:winner?.workers??[],ranked},note:'ACCEPT authorizes consideration by ACTION-REPAIR only; it does not assert source mutation success or Canonical GREEN.'};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',botId:'ACTION-ARBITER',disposition,acceptedStrategyId:result.decision.acceptedStrategyId,consensusCount:result.decision.consensusCount,output},null,2));process.exit(disposition==='ACCEPT'?0:2);
}
throw new Error('ACTION_COUNCIL_UNKNOWN_MODE='+mode);