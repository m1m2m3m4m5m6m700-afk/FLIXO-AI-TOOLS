#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const REGISTRY=path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');
const SHARED_REFS=[
  'docs/agents/historical-action-errors/index.json',
  'docs/agents/historical-action-errors/records',
  'docs/AUTO_REPAIR_HISTORY.jsonl',
  'diagnostics/auto-repair/memory.json',
  'docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json',
  'docs/agents/ERROR-TEACHING-ROUTER.json',
  'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md',
  'scripts/ci/error-learning-log.mjs'
];
const DEFAULT_WORKERS=[
  ['CELL-001','PRIMARY_ACTION_RCA'],
  ['CELL-002','HISTORICAL_STRATEGY_TRANSFER'],
  ['CELL-003','INFERENTIAL_ALTERNATIVE'],
  ['CELL-004','FALSIFICATION_AND_RISK'],
  ['CELL-005','REGRESSION_AND_IMPACT']
];
const OUT=process.env.FLIXO_FIVE_ACTION_REPAIR_OUTPUT||'/tmp/flixo-five-action-repair-workers.json';
const arg=(name,fallback='')=>{
  const p='--'+name+'=';
  const hit=process.argv.find(v=>v.startsWith(p));
  return hit?hit.slice(p.length):String(fallback);
};
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=v=>/^[a-f0-9]{40}$/iu.test(String(v??''));
const targetSha=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA);
const runId=arg('run-id',process.env.TARGET_RUN_ID);
const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT);
const logPath=arg('log',process.env.FLIXO_FAILURE_LOG||'');
if(!sha(targetSha)) throw new Error('FIVE_ACTION_REPAIR_TARGET_SHA_INVALID');
if(!runId) throw new Error('FIVE_ACTION_REPAIR_RUN_ID_REQUIRED');
if(!fingerprint) throw new Error('FIVE_ACTION_REPAIR_FINGERPRINT_REQUIRED');
if(logPath && !fs.existsSync(logPath)) throw new Error('FIVE_ACTION_REPAIR_LOG_MISSING');
const registry=readJson(REGISTRY);
const cohort=registry.actionRepairCohort||{};
const workerIds=Array.isArray(cohort.workerIds)&&cohort.workerIds.length===5?cohort.workerIds:DEFAULT_WORKERS.map(x=>x[0]);
const workers=workerIds.map((id)=>registry.bots.find((bot)=>bot.id===id)).filter(Boolean);
if(workers.length!==5) throw new Error('FIVE_ACTION_REPAIR_WORKER_COUNT_INVALID');
const missing=SHARED_REFS.filter(ref=>!fs.existsSync(path.join(ROOT,ref)));
if(missing.length) throw new Error('FIVE_ACTION_REPAIR_SHARED_REFERENCE_MISSING='+missing.join(','));
const log=logPath?fs.readFileSync(logPath,'utf8'):'';
const normalized=log.replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu,'').replace(/\s+/gu,' ').trim();
const digest=crypto.createHash('sha256').update(normalized,'utf8').digest('hex');
const errorClasses=[
  ['security',/codeql|security|forbidden|unauthorized|permission/iu],
  ['build',/vite|rollup|module not found|build failed|npm err/iu],
  ['type-or-lint',/typescript|ts\d{3,4}|eslint|no-unused|type .* is not assignable/iu],
  ['browser',/playwright|chromium|webkit|firefox|expect\(|locator\(|timeout/iu],
  ['workflow-control',/workflow|matrix|concurrency|queued|cancelled|sha mismatch|head sha/iu],
  ['provider',/vercel|supabase|rate limit|quota|429|api-deployments-free/iu],
];
const detected=errorClasses.filter(([,re])=>re.test(normalized)).map(([id])=>id);
const taskTitle='Repair GitHub Actions failure on exact target SHA';
const sourceOfTruthRefs=[...SHARED_REFS];
const workerModes=cohort.workerModes||Object.fromEntries(DEFAULT_WORKERS);
const packets=workerIds.map((id,index)=>{
  const bot=workers[index];
  const mode=workerModes[id]||DEFAULT_WORKERS[index][1];
  return {
    schemaVersion:1,
    workerId:id,
    workerIndex:index+1,
    taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,
    role:mode,
    status:'ACTIVE_ANALYSIS',
    target:{runId,failedSha:targetSha,failureFingerprint:fingerprint,logDigest:digest},
    task:{title:taskTitle,scope:'ANY_GITHUB_ACTIONS_FAILURE',sameIncidentContext:true},
    sharedReferences:sourceOfTruthRefs,
    observedClasses:detected,
    workerInstruction:[
      'Use the same incident and the same historical Action-error references as every other worker.',
      'Compare literal diagnosis with historical successful repairs and anti-lessons.',
      'Generate an exact-SHA-bound repair hypothesis and one falsification check.',
      'Do not mutate source, main, workflow control, or permissions from the worker lane.',
      'Return a repair packet to assistantController; canonical repairAgent owns mutation.'
    ],
    mutationAuthority:false,
    canonicalMutationOwner:'repairAgent',
    proofRule:'CURRENT_EXACT_SHA_CI_ONLY',
    priority:index+1
  };
});
const report={
  schemaVersion:1,
  authority:'CELL_ACTION_REPAIR_WORKER_FANOUT',
  workerCount:5,
  workers:packets,
  sharedReferences:sourceOfTruthRefs,
  sameReferencesForAll:true,
  anyActionFailureAdmitted:true,
  mutationModel:'FIVE_ANALYSIS_WORKERS_ONE_CANONICAL_MUTATION_LANE',
  noIndependentMutation:true,
  generatedAt:new Date().toISOString()
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',workerCount:5,targetSha,runId,fingerprint,output:OUT,detectedClasses:detected},null,2));
