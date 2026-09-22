#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fingerprintFailure, normalizeFailure, extractFeatures, loadMemory } from './auto-repair/fingerprint.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { critiqueRepair } from './auto-repair/self-critic.mjs';
import { buildRepairKnowledgeGraph } from './auto-repair/knowledge-graph.mjs';
import { buildErrorOnlyRepairModel } from './auto-repair/error-only-programmer.mjs';
import { buildCausalDiscriminator } from './action-causal-discriminator.mjs';
import { buildMetaCausalModel } from './meta-causal-model.mjs';
import { buildMentorPacket } from './action-code-mentor.mjs';
import { buildPrediction as buildActionVaultPrediction } from './action-historical-predictor.mjs';

const ROOT=process.cwd();
const exactSha=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));
const hash=(v)=>createHash('sha256').update(String(v),'utf8').digest('hex');
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
const readJson=(file,fallback=null)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();


function runProgrammerTwinReadOnly({log,targetSha,fingerprint,diagnosis,selected}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-readonly-twin-'));
  const logPath = path.join(tempRoot, 'failure.log');
  const selectionPath = path.join(tempRoot, 'selection.json');
  const diagnosisPath = path.join(tempRoot, 'diagnosis.json');
  const outputPath = path.join(tempRoot, 'twin.json');
  try {
    const selectedFile = selected?.file ?? diagnosis?.location?.file ?? null;
    fs.writeFileSync(logPath, String(log ?? ''), 'utf8');
    fs.writeFileSync(selectionPath, JSON.stringify({
      decision: 'SELECTED',
      targetSha,
      failureFingerprint: fingerprint,
      selectedFiles: selectedFile ? [{ path: selectedFile }] : [],
    }) + '\n', 'utf8');
    fs.writeFileSync(diagnosisPath, JSON.stringify({
      ...(diagnosis ?? {}),
      failureLog: String(log ?? ''),
      targetSha,
      sourceMutationAllowed: false,
    }) + '\n', 'utf8');
    execFileSync(process.execPath, [
      path.resolve(ROOT, 'scripts/ci/action-repair-programmer-twin.mjs'),
      '--sha=' + targetSha,
      '--fingerprint=' + fingerprint,
      '--run-id=READ_ONLY',
      '--log=' + logPath,
      '--file-selection=' + selectionPath,
      '--diagnosis=' + diagnosisPath,
      '--output=' + outputPath,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
    return readJson(outputPath, null);
  } catch (error) {
    return {
      protocol: 'INDEPENDENT_FALSIFICATION_REPORT-v1',
      role: 'ADVERSARIAL_PROGRAMMER_FALSIFIER',
      status: 'READ_ONLY_TWIN_UNAVAILABLE',
      authorityParity: 'NO_MUTATION_AUTHORITY',
      error: String(error?.message ?? error),
    };
  } finally {
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  }
}

function buildAdversarialMirror({log, targetSha, fingerprint, diagnosis, plan, selectedCandidate, historicalKnowledge=[]}){
  const alternatives=[];
  const root=String(diagnosis?.rootCause??'unknown');
  const features=extractFeatures(log);
  const candidates=Array.isArray(plan?.candidates)?plan.candidates:[];
  const selectedId=selectedCandidate?.id??plan?.selected?.id??null;
  const signals=String(log).match(/(?:ERROR|Error:|FAIL|FATAL|CAPIError|SessionModelError|CI contract failed|TS\d+|TypeError|ReferenceError|SyntaxError)[^\n]*/giu)??[];
  const sourceFiles=[...new Set(candidates.map(x=>x.file??x.targetFile??diagnosis?.location?.file).filter(Boolean))];
  const tests=[
    {
      id:'ALT_ROOT_CAUSE',
      question:'Could a materially different root cause explain the same observation?',
      evidence:[root,...features],
      verdict:root==='unknown'?'OPEN':'CHALLENGE_REQUIRED'
    },
    {
      id:'WRONG_REPAIR_RULE',
      question:'Does the selected repair rule actually match the demonstrated failure class?',
      evidence:[selectedId,...features],
      verdict:selectedId?'CHALLENGE_REQUIRED':'BLOCKED'
    },
    {
      id:'WRONG_FILE',
      question:'Is the proposed source surface causally connected to the observed failure?',
      evidence:[...(sourceFiles.length?sourceFiles:['NO_SOURCE_FILE']),diagnosis?.location?.file??'NO_DIAGNOSIS_LOCATION'],
      verdict:sourceFiles.length?'LINKAGE_REQUIRES_VERIFICATION':'BLOCKED'
    },
    {
      id:'EXTERNAL_MISCLASSIFICATION',
      question:'Is an external provider failure being incorrectly turned into a source repair?',
      evidence:signals.filter(s=>/CAPIError|SessionModelError|rate limit|provider/i.test(s)),
      verdict:/CAPIError|SessionModelError|rate limit|provider/i.test(log)?'HIGH_RISK':'NO_DIRECT_EXTERNAL_SIGNAL'
    },
    {
      id:'STALE_IDENTITY',
      question:'Would the reasoning remain valid if the target SHA changed?',
      evidence:[targetSha],
      verdict:exactSha(targetSha)?'SHA_BOUND':'BLOCKED'
    },
    {
      id:'CONTROL_PLANE_COLLISION',
      question:'Could the proposed path cross protected CI/control-plane boundaries?',
      evidence:sourceFiles.filter(f=>/^(?:scripts\/ci|\.github\/workflows)/u.test(f)),
      verdict:sourceFiles.some(f=>/^(?:scripts\/ci|\.github\/workflows)/u.test(f))?'HIGH_RISK':'NO_DIRECT_CONTROL_PLANE_TARGET'
    },
    {
      id:'HISTORICAL_REJECTION',
      question:'Has the same strategy or rule previously failed or been reverted?',
      evidence:(historicalKnowledge??[]).filter(x=>x.rule===selectedId||x.rootCause===root).slice(0,8),
      verdict:(historicalKnowledge??[]).some(x=>x.rule===selectedId&&Number(x.successes??0)===0)?'REJECTED_HISTORY_SIGNAL':'NO_REJECTION_SIGNAL'
    },
    {
      id:'HIDDEN_COUPLING',
      question:'Could a nearby dependent workflow/script make the primary repair insufficient?',
      evidence:['caller/callee graph','dependency graph','contract graph'],
      verdict:'REQUIRES_GRAPH_VERIFICATION'
    },
  ];
  const blockers=tests.filter(x=>['BLOCKED','HIGH_RISK','REJECTED_HISTORY_SIGNAL'].includes(x.verdict));
  const unresolved=tests.filter(x=>['CHALLENGE_REQUIRED','LINKAGE_REQUIRES_VERIFICATION','REQUIRES_GRAPH_VERIFICATION'].includes(x.verdict));
  const counterexampleFound=blockers.some(x=>x.id==='WRONG_REPAIR_RULE'||x.id==='WRONG_FILE'||x.id==='EXTERNAL_MISCLASSIFICATION'||x.id==='HISTORICAL_REJECTION');
  return {
    protocol:'READ-ONLY-ADVERSARIAL-REPAIR-MIRROR-v1',
    role:'ADVERSARIAL_PROGRAMMER_FALSIFIER_MIRROR',
    targetSha,
    failureFingerprint:fingerprint,
    intelligenceParity:'FULL_REASONING_STACK_MIRROR',
    authorityParity:'NO_MUTATION_AUTHORITY',
    primaryRepairCandidate:selectedId,
    alternativeHypotheses:tests,
    falsificationSearches:tests,
    counterexampleFound,
    falsificationComplete:false,
    unresolvedChallenges:unresolved,
    blockers,
    status:counterexampleFound?'COUNTEREXAMPLE_FOUND':'CHALLENGE_OPEN',
    rule:'No counterexample is not proof of repair correctness.',
  };
}

export function buildRepairIntelligenceMirror({failureLog='',targetSha='',historicalSignals={},deepInference=null,selectedCandidate=null,failedRunId='READ_ONLY',full=true}={}){
  if(!exactSha(targetSha)) throw new Error('REPAIR_INTELLIGENCE_MIRROR_EXACT_SHA_REQUIRED');
  const log=String(failureLog??'');
  const fingerprint=fingerprintFailure(log);
  const memory=loadMemory();
  const historicalKnowledge=[
    ...(memory.cases??[]).map(x=>({fingerprint:x.fingerprint,rootCause:x.rootCause,rule:x.rule,attempts:x.attempts,successes:x.successes,outcome:x.outcome})),
    ...(memory.lessons??[]).map(x=>({fingerprint:x.fingerprint,rootCause:x.rootCause,rule:x.rule,attempts:x.attempts,successes:x.successes,confidence:x.confidence,anti:x.anti}))
  ];
  const plan=planRepair(log,{historical:historicalKnowledge.map(x=>({rootCause:x.rootCause,confidence:x.attempts?x.successes/x.attempts:0})),memory});
  const selected=selectedCandidate??plan.selected??null;
  const diagnosis=plan.reasoning??null;
  const errorOnly=buildErrorOnlyRepairModel({log,diagnosis,selected,targetSha});
  const confidence=confidenceGate({
    selected,
    features:plan.features??extractFeatures(log),
    changedFiles:0,
    changedLines:0
  });
  const selfCritic=critiqueRepair({
    diff:'',
    diffSummary:{files:[],lines:0},
    plan:selected,
    diagnosis,
    simulation:null
  });
  const knowledgeGraph=buildRepairKnowledgeGraph({
    fingerprint,
    targetSha,
    diagnosis,
    plan:selected,
    simulation:null,
    selfCritic,
    causalProof:null
  });
  const causalDiscriminator=buildCausalDiscriminator({
    failureLog:log,
    exactCases:(memory.cases??[]).filter(x=>x.fingerprint===fingerprint),
    doNotRepeat:[...(memory.cases??[]).filter(x=>x.fingerprint===fingerprint).flatMap(x=>[...(x.failedStrategies??[]),...(x.revertedRules??[])])],
    fingerprint,
    targetSha
  });
  const metaCausalModel=buildMetaCausalModel({
    failureLog:log,
    targetSha,
    currentHeadSha:git(['rev-parse','HEAD']),
    failedRunId:'READ_ONLY',
    taskId:'READ_ONLY_REPAIR_INTELLIGENCE:'+fingerprint,
    branch:'execution',
    strictIdentity:true,
    historicalKnowledge,
    exactCases:[],
    doNotRepeat:[]
  });
  const mentorPacket=full ? (() => {
    try {
      return buildMentorPacket({
        taskId:'READ_ONLY_REPAIR_INTELLIGENCE:'+fingerprint,
        fingerprint,
        targetSha,
        failedRunId:String(failedRunId),
        sourceFiles:[...new Set([diagnosis?.location?.file,selected?.file].filter(Boolean))],
        mode:'DEEP',
        changedPaths:[],
        deep:true
      });
    } catch (error) {
      return { protocol:'CODE_MENTOR_PACKET_V3', status:'READ_ONLY_MENTOR_UNAVAILABLE', readOnly:true, error:String(error?.message ?? error) };
    }
  })() : { protocol:'CODE_MENTOR_PACKET_V3', status:'SKIPPED_IN_UNIT_TEST', readOnly:true };
  const actionVaultPrediction=full ? (() => {
    try {
      return buildActionVaultPrediction({
        taskId:'READ_ONLY_REPAIR_INTELLIGENCE:'+fingerprint,
        fingerprint,
        targetSha,
        failedRunId:String(failedRunId),
        failureLog:log,
        workflow:String(historicalSignals?.workflow??''),
        job:String(historicalSignals?.job??'')
      });
    } catch (error) {
      return {
        protocol:'PREDICTIVE_REPAIR_PACKET_V1',
        status:'READ_ONLY_ACTION_VAULT_PREDICTION_UNAVAILABLE',
        identity:{taskId:'READ_ONLY_REPAIR_INTELLIGENCE:'+fingerprint,fingerprint,targetSha,failedRunId:String(failedRunId)},
        search:{historicalIndex:false,actionIndex4000:false,repairMemory:true},
        proposedRepair:{mode:'OWNER_REVIEW_REQUIRED',confidence:0,notCertain:true},
        error:String(error?.message ?? error)
      };
    }
  })() : {
    protocol:'PREDICTIVE_REPAIR_PACKET_V1',
    status:'SKIPPED_IN_UNIT_TEST',
    mutationAuthority:'NONE',
    identity:{taskId:'READ_ONLY_REPAIR_INTELLIGENCE:'+fingerprint,fingerprint,targetSha,failedRunId:String(failedRunId)},
    proposedRepair:{mode:'OWNER_REVIEW_REQUIRED',confidence:0,notCertain:true}
  };
  const adversarial=buildAdversarialMirror({
    log,targetSha,fingerprint,diagnosis,plan,selectedCandidate:selected,historicalKnowledge
  });
  const programmerTwin=full ? runProgrammerTwinReadOnly({
    log,
    targetSha,
    fingerprint,
    diagnosis,
    selected
  }) : { protocol:'INDEPENDENT_FALSIFICATION_REPORT-v1', status:'SKIPPED_IN_UNIT_TEST', authorityParity:'NO_MUTATION_AUTHORITY' };
  return {
    protocol:'FLIXO-READ-ONLY-REPAIR-INTELLIGENCE-v1',
    mode:'READ_AND_REASON_ONLY',
    mutationPolicy:'NO_SOURCE_MUTATION',
    exactShaVerified:true,
    targetSha,
    fingerprint,
    failure:{normalized:normalizeFailure(log),features:extractFeatures(log),salientSignals:(log.match(/(?:ERROR|Error:|FAIL|FATAL|CAPIError|SessionModelError|CI contract failed|TS\d+|TypeError|ReferenceError|SyntaxError)[^\n]*/giu)??[]).slice(0,30)},
    primaryRepairIntelligence:{
      planner:plan,
      errorOnlyModel:errorOnly,
      confidenceGate:confidence,
      selfCriticPreview:selfCritic,
      knowledgeGraph,
      causalDiscriminator,
      metaCausalModel,
      codeMentor:mentorPacket,
      actionVaultPrediction
    },
    adversarial,
    deepInference,
    synthesis:{
      primaryCandidate:selected?.id??null,
      rootCause:diagnosis?.rootCause??null,
      causalConfidence:Number(diagnosis?.causalConfidence??0),
      plannerBlockedReason:plan.blockedReason??null,
      externalBoundary:diagnosis?.decision==='BLOCK_EXTERNAL',
      adversarialStatus:adversarial.status,
      programmerTwinStatus:programmerTwin?.status??null,
      programmerTwinMode:'READ_ONLY_MIRROR',
      actionVaultPredictionStatus:actionVaultPrediction?.status??'UNKNOWN',
      actionVaultPredictionConfidence:Number(actionVaultPrediction?.proposedRepair?.confidence??0),
      mutationWouldBeAllowedByRepairStack:Boolean(errorOnly.repair?.mutationAllowed)&&Boolean(confidence.allowed)&&adversarial.counterexampleFound===false,
      readOnlyDecision:'REPORT_ONLY'
    },
    learningContext:{
      memoryCaseCount:(memory.cases??[]).length,
      lessonCount:(memory.lessons??[]).length,
      historicalKnowledgeEntries:historicalKnowledge.length,
      historicalSignals
    },
    nextEvidence:[
      'Acquire exact failure log and exact run identity for the active RED.',
      'Resolve adversarial challenges before treating the primary repair hypothesis as reliable.',
      'Trace selected source/workflow dependencies against the current exact SHA.',
      'Use Action Vault historical prediction only as ranked evidence; require current exact-SHA proof before any repair authority.',
      'Never convert the mirror recommendation or Action Vault prediction into mutation authority.'
    ],
    digest:hash(JSON.stringify({targetSha,fingerprint,selected:selected?.id??null,adversarialStatus:adversarial.status,planBlocked:plan.blockedReason??null}))
  };
}

if(import.meta.url==='file://'+process.argv[1]){
 const input=readJson(arg('input'),null);
 if(!input||typeof input.failureLog!=='string') throw new Error('REPAIR_INTELLIGENCE_INPUT_REQUIRED');
 const targetSha=arg('sha')||input.targetSha||git(['rev-parse','HEAD']);
 const report=buildRepairIntelligenceMirror({...input,targetSha});
 const output=path.resolve(ROOT,arg('output','diagnostics/investigation/repair-intelligence-mirror-latest.json'));
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',authority:report.protocol,targetSha,primaryCandidate:report.synthesis.primaryCandidate,adversarialStatus:report.adversarial.status,readOnly:true,output},null,2));
}
