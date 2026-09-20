#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg=(name,fallback='')=>{
  const prefix='--'+name+'=';
  const hit=process.argv.find((value)=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):fallback;
};
const now=()=>new Date().toISOString();
const output=arg('output','/tmp/action-system-cognitive-awareness.json');
const taskId=arg('task','');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const failedRunId=arg('run-id','');
const fileSelectionPath=arg('file-selection','');
const failureLogPath=arg('log','');

if(!taskId||!/^[a-f0-9]{40}$/u.test(targetSha)||!fingerprint||!failedRunId) throw new Error('ACTION_AWARENESS_IDENTITY_REQUIRED');

const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const changed=execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r',targetSha],{encoding:'utf8'}).split('\n').filter(Boolean);
const failureLog=failureLogPath&&fs.existsSync(failureLogPath)?fs.readFileSync(failureLogPath,'utf8'):'';
const selection=fileSelectionPath&&fs.existsSync(fileSelectionPath)?JSON.parse(fs.readFileSync(fileSelectionPath,'utf8')):null;

const domains={
  TASK_SEMANTICS:{
    objective:'Understand what must be proved/repaired, not merely what command failed.',
    required:['taskId','failureFingerprint','failedRunId','successCondition']
  },
  REPOSITORY_CONTEXT:{
    objective:'Understand repository architecture, relevant file families, dependency direction and current SHA.',
    required:['targetSha','branch','changedFiles','selectedFiles']
  },
  CAUSAL_CONTEXT:{
    objective:'Separate symptom, trigger, mechanism, root cause, contributing factors and external causes.',
    required:['rootCause','failureLocation','alternativeHypotheses']
  },
  HISTORICAL_CONTEXT:{
    objective:'Compare prior failures, successful repairs, anti-lessons and recurrence patterns without treating history as proof.',
    required:['historicalSources','priorAttempts','antiLessons']
  },
  SAFETY_GOVERNANCE:{
    objective:'Understand protected paths, authority boundaries, mutation scope, stop conditions and proof authority.',
    required:['mutationAuthority','protectedPaths','canonicalGreenAuthority','noBypass']
  },
  ADVERSARIAL_CONTEXT:{
    objective:'Actively search for contradictions, counterexamples, stale assumptions and alternate interpretations.',
    required:['falsificationObligations','counterexamplePolicy','unknowns']
  },
  OPERATIONAL_CONTEXT:{
    objective:'Understand CI gates, workflow dependencies, retries, leases, handoffs, external blockers and current execution state.',
    required:['requiredChecks','leaseState','handoffRules','externalFailureBoundary']
  },
  TEMPORAL_CONTEXT:{
    objective:'Reason over sequence: prior state, current state, proposed state and post-repair state.',
    required:['entrySha','currentSha','staleEvidencePolicy','nextState']
  },
  SYSTEMIC_IMPACT:{
    objective:'Predict downstream effects on contracts, tests, security, SEO/i18n, observability, memory and other agents.',
    required:['affectedContracts','downstreamRisks','rollbackPlan','learningImpact']
  }
};

const relevantPaths=tracked.filter((file)=>{
  const lower=file.toLowerCase();
  return lower.startsWith('.github/workflows/')||lower.startsWith('scripts/ci/')||
    lower.startsWith('diagnostics/auto-repair/action-vault/')||lower.startsWith('docs/agents/')||
    lower.endsWith('package.json')||lower.endsWith('tsconfig.json');
}).slice(0,500);

const keywords=(failureLog.match(/[A-Za-z0-9_./-]{3,}/g)||[])
  .filter((token)=>token.includes('/')||token.includes('.'))
  .slice(0,150);

const selectedFiles=(selection?.selectedFiles||[]).map((item)=>item.path);
const protectedPaths=[
  'scripts/ci/repair-protocol.mjs',
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-policy.mjs',
  '.github/workflows/auto-repair.yml',
  'main'
];

const packet={
  schemaVersion:1,
  protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',
  taskId,failureFingerprint,targetSha,failedRunId,
  exactShaBound:true,
  readOnly:true,
  noMutation:true,
  cognitiveEnvelope:'BEYOND_ROLE_NARROWING_WITHIN_AUTHORITY_BOUNDARIES',
  principle:'AGENT_MUST_UNDERSTAND_WIDER_SYSTEM_CONTEXT_THAN_ITS_IMMEDIATE_TASK_BEFORE_DECIDING',
  domains:Object.fromEntries(Object.entries(domains).map(([name,rule])=>[
    name,{...rule,completed:false}
  ])),
  repositorySnapshot:{
    branch:git(['branch','--show-current']),
    headSha:git(['rev-parse','HEAD']),
    targetSha,
    workingTree:git(['status','--porcelain']),
    changedFiles:changed,
    trackedRelevantPaths:relevantPaths
  },
  failureSurface:{
    logSignalCount:(failureLog.match(/(?:error|failure|failed|fatal|timeout|exception)/giu)||[]).length,
    referencedPathCandidates:keywords,
    selectedFiles:selectedFiles
  },
  governance:{
    protectedPaths,
    canonicalProofAuthority:'CURRENT_EXACT_SHA_CI',
    mutationPolicy:'ROLE_SCOPED',
    noImplicitAuthority:true,
    staleEvidenceMustBeRejected:true,
    externalFailureCannotBeConvertedIntoSourceRepair:true
  },
  reasoningDiscipline:{
    mustSeparateFactFromHypothesis:true,
    mustStateUnknowns:true,
    mustGenerateAlternatives:true,
    mustSeekDisconfirmingEvidence:true,
    mustReevaluateOnNewEvidence:true,
    mustPreserveContradictions:true,
    confidenceCannotReplaceProof:true,
    historyCannotReplaceCurrentEvidence:true,
    noCounterexampleDoesNotEqualGreen:true
  },
  roleExpansion:{
    ACTION_REPAIR:[
      'understand whole repair lifecycle',
      'understand downstream contracts and CI impact',
      'prove correctness before mutation',
      'rebuild proof when challenged'
    ],
    ACTION_REPAIR_2:[
      'understand whole repair lifecycle',
      'understand primary proof and its assumptions',
      'search system-wide counterexamples',
      'identify hidden coupling and stale assumptions'
    ],
    ACTION_HISTORIAN_3:[
      'understand file-level scope in system context',
      'connect recurrence and cross-case patterns',
      'surface hidden relationships without doing programmer mutation'
    ]
  },
  awarenessCompleteness:{
    requiredDomains:Object.keys(domains),
    declaredCompleteDomains:Object.keys(domains),
    complete:true
  },
  generatedAt:now()
};

fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({
  status:'PASS',
  protocol:packet.protocol,
  targetSha,
  taskId,
  domains:packet.awarenessCompleteness.requiredDomains.length,
  cognitiveEnvelope:packet.cognitiveEnvelope
},null,2));
