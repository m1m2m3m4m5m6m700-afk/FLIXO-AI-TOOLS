#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const arg=(name,fallback='')=>{const p='--'+name+'=';const v=process.argv.find(x=>x.startsWith(p));return v?v.slice(p.length):fallback};
const task=arg('task');
const fingerprint=arg('fingerprint');
const targetSha=arg('sha');
const runId=arg('run-id');
const logPath=arg('log');
const output=arg('output','/tmp/action-agent-runtime.json');

const MODEL_DEFAULTS=Object.freeze({
  ACTION_COMMANDER_V1:{modelProfile:'FRONTIER_REASONING',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_PRIMARY_REPAIR_V1:{modelProfile:'FRONTIER_REASONING',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_ADVERSARIAL_REPAIR_V1:{modelProfile:'FRONTIER_REASONING_ADVERSARIAL',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true}
});

const readJson=(p,d)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):d;
const sha256=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
must(task,'ACTION_AGENT_RUNTIME_TASK_REQUIRED');
must(fingerprint,'ACTION_AGENT_RUNTIME_FINGERPRINT_REQUIRED');
must(/^[a-f0-9]{40}$/u.test(targetSha),'ACTION_AGENT_RUNTIME_EXACT_SHA_REQUIRED');
must(runId,'ACTION_AGENT_RUNTIME_RUN_ID_REQUIRED');

const historyIndex=readJson(path.join(ROOT,'docs/agents/historical-action-errors/index.json'),{byFingerprint:{},byNormalized:{},byClass:{},byWorkflow:{},recordCount:0});
const actionMemory=readJson(path.join(ROOT,'diagnostics/auto-repair/memory.json'),{cases:[],actionHistory:[],lessons:[],antiLessons:[]});
const vaultIntelligence=readJson(path.join(ROOT,'diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json'),{});
const grade=readJson(path.join(ROOT,'diagnostics/auto-repair/action-vault/ACTION-VAULT-AGENT-GRADE.json'),{});
const activityIndex=readJson(path.join(ROOT,'docs/agents/historical-action-errors/agent-activity/index.json'),{byFingerprint:{},records:[]});
const failureLog=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';

const normalizedLog=failureLog.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\b\d{10,}\b/g,'<ID>').replace(/\b[a-f0-9]{40}\b/gi,'<SHA>').replace(/\s+/g,' ').trim().slice(0,16000);
const currentFeatures=[...new Set((normalizedLog.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)||[]).slice(0,120))];

const exactHistoricalIds=historyIndex.byFingerprint?.[fingerprint]??[];
const exactCases=(actionMemory.cases??[]).filter(x=>x.fingerprint===fingerprint);
const historicalActivityIds=activityIndex.byFingerprint?.[fingerprint]??[];
const historicalActivity=(activityIndex.records??[]).filter(x=>historicalActivityIds.includes(x.id)).slice(-20);
const candidateCases=(actionMemory.cases??[]).filter(x=>x.fingerprint!==fingerprint && (x.features??[]).some(f=>currentFeatures.includes(f))).slice(-50);

const strategyHistory=(exactCases.flatMap(x=>[
  ...(x.successfulStrategies??[]).map(s=>({strategy:s,status:'SUCCESS'})),
  ...(x.failedStrategies??[]).map(s=>({strategy:s,status:'REJECTED'})),
  ...(x.rules??[]).map(s=>({strategy:s,status:'HISTORICAL_RULE'}))
])).slice(-100);
const doNotRepeat=[...new Set(strategyHistory.filter(x=>x.status==='REJECTED').map(x=>x.strategy).filter(Boolean))];

const evidenceItems=[
  {id:'CURRENT_FAILURE_LOG',strength:failureLog?1:0,required:true,binding:'CURRENT_RUN'},
  {id:'EXACT_TARGET_SHA',strength:/^[a-f0-9]{40}$/u.test(targetSha)?1:0,required:true,binding:targetSha},
  {id:'HISTORICAL_EXACT_FINGERPRINT',strength:exactHistoricalIds.length?0.9:0.2,required:false,binding:fingerprint},
  {id:'HISTORICAL_ACTIVITY',strength:historicalActivity.length?0.85:0.1,required:false,binding:fingerprint},
  {id:'CURRENT_CANONICAL_CI',strength:0,required:true,binding:'PROVE_AFTER_REPAIR'}
];

const phases=['INTAKE','CONTEXT_RETRIEVAL','PLAN','EXECUTE','SELF_CHECK','INDEPENDENT_REVIEW','VERIFY','LEARN'];
const lanes={
  CHIEF:{agentId:'ACTION-MASTER',profile:'ACTION_COMMANDER_V1',lane:'ORCHESTRATION_AND_TOOL_SELECTION'},
  PRIMARY:{agentId:'ACTION-REPAIR',profile:'ACTION_PRIMARY_REPAIR_V1',lane:'RCA_REPAIR_VERIFICATION'},
  ADVERSARIAL:{agentId:'ACTION-REPAIR-2',profile:'ACTION_ADVERSARIAL_REPAIR_V1',lane:'FALSIFICATION_ALTERNATIVE_RCA'},
  HISTORIAN:{agentId:'ACTION-HISTORIAN-3',profile:'ACTION_PRIMARY_REPAIR_V1',lane:'PROVENANCE_INDEX_LEARNING'}
};

const hypothesisBase=[
  {id:'H1',kind:'PRIMARY',statement:normalizedLog?'Root cause must be causally supported by the exact current failure evidence.':'No current failure log supplied; hypothesis is provisional.',score:normalizedLog?0.55:0.2,requiresFreshEvidence:true},
  {id:'H2',kind:'ADVERSARIAL',statement:'The visible RED may be a propagated symptom; test an earlier causal boundary before mutation.',score:0.6,requiresFalsification:true}
];
if(exactHistoricalIds.length) hypothesisBase[0].score+=0.2;
if(historicalActivity.length) hypothesisBase[1].score+=0.1;

const toolBudget={
  maxToolCalls:24,
  maxHistoricalRecords:100,
  maxMessagesPerAgent:200,
  maxCandidateHypotheses:8,
  stopOnRepeatedStrategy:true,
  stopOnEvidenceMismatch:true,
  parallelReadsAllowed:true,
  parallelMutationAllowed:false
};

const safety={
  exactShaRequired:true,
  evidenceFirst:true,
  unknownsExplicit:true,
  selfCritiqueRequired:true,
  independentReviewRequired:true,
  noSelfApproval:true,
  noCertificationAuthority:true,
  failClosed:true,
  structuredOutputRequired:true,
  noMainMutation:true,
  noTestMutation:true,
  singleActiveMutationOwner:true,
  externalFailureNeverBecomesSourceRepair:true
};

const profileConfig=(profile)=>MODEL_DEFAULTS[profile]??MODEL_DEFAULTS.ACTION_PRIMARY_REPAIR_V1;
const runtime={
  schemaVersion:1,
  protocol:'ACTION-AGENT-RUNTIME-v1',
  status:'READY',
  identity:{taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,identityDigest:sha256(task+'|'+fingerprint+'|'+targetSha+'|'+runId)},
  modelProfiles:Object.fromEntries(Object.entries(lanes).map(([lane,agent])=>[agent.agentId,{...agent,config:profileConfig(agent.profile)}])),
  cognitiveLoop:phases,
  historicalContext:{
    exactFingerprintRecordIds:exactHistoricalIds,
    exactCases,
    historicalActivity,
    candidateCases,
    doNotRepeat,
    corpusRecordCount:Number(historyIndex.recordCount??0),
    memoryCaseCount:Number((actionMemory.cases??[]).length),
    actionHistoryCount:Number((actionMemory.actionHistory??[]).length)
  },
  evidence:{items:evidenceItems,minimumActionableScore:0.8,proofAuthority:'DAILY_FLIXO_GREEN_GATE'},
  hypotheses:hypothesisBase,
  toolBudget,
  safety,
  lifecycle:{current:'INTAKE',next:'CONTEXT_RETRIEVAL',closure:'CANONICAL_GREEN_ONLY'},
  outputContract:{
    required:[ 'currentEvidence','unknowns','historicalMatches','candidateHypotheses','selectedStrategy','selfCritique','independentReview','targetedRegression','exactSha','canonicalGreen' ],
    selectedStrategyMayBeNull:true,
    mutationMayBeNull:true
  },
  generatedAt:new Date().toISOString()
};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(path.resolve(output),JSON.stringify(runtime,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',protocol:runtime.protocol,targetSha,fingerprint,exactHistoricalMatches:exactHistoricalIds.length,historicalActivityMatches:historicalActivity.length,doNotRepeatCount:doNotRepeat.length,toolBudget:toolBudget.maxToolCalls,phase:runtime.lifecycle.current},null,2));
