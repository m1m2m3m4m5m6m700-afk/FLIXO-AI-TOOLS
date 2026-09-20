#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fingerprintFailure } from './auto-repair/fingerprint.mjs';

const ROOT = process.cwd();
const MEMORY = process.env.FLIXO_REPAIR_MEMORY ?? path.join(ROOT, 'diagnostics/auto-repair/memory.json');
const FAILURE_LOG = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const OUTPUT = process.env.FLIXO_REPAIR_TRAINING_PATH ?? '/tmp/flixo-repair-training.json';
const DIAGNOSIS = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';

export const STRATEGIES = Object.freeze([
  'reproduce-exact','minimize-failure','diff-forensics','environment-audit','workflow-forensics',
  'observability-trace','historical-analogy','synthetic-reproduction','alternate-hypothesis','supervising-escalation',
]);
export const CURRICULUM = Object.freeze([
  ['T01','exact_sha'],['T02','root_cause'],['T03','hypothesis'],['T04','strategy_selection'],['T05','negative_learning'],
  ['T06','external_isolation'],['T07','minimal_repair'],['T08','regression'],['T09','recurrence'],['T10','closure'],
]);
const SUCCESS = new Set(['success','verified-repair','verified-historical-revert']);
const FAILURE = new Set(['failure','unrepaired','blocked','reverted-repair','revert-failure']);
const sha256 = (v) => createHash('sha256').update(String(v), 'utf8').digest('hex');
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const norm = (v) => String(v ?? '').trim().toLowerCase();

function memoryExamples(memory) {
  const out = [];
  for (const c of memory.cases ?? []) {
    for (const o of c.outcomes ?? []) {
      const strategyId = norm(o?.provenance?.strategyId);
      if (!STRATEGIES.includes(strategyId)) continue;
      const state = norm(o?.outcome);
      out.push({
        source: 'verified-repair-memory',
        fingerprint: String(c.fingerprint ?? sha256(c.normalizedFailure ?? c.rootCause ?? 'case')),
        rootCause: norm(c.rootCause ?? 'unknown'),
        features: Array.isArray(c.features) ? c.features.map(norm) : [],
        failedSha: o?.provenance?.failedSha ?? null,
        targetSha: o?.provenance?.targetSha ?? null,
        at: o?.at ?? null,
        strategyId,
        outcome: SUCCESS.has(state) ? 'success' : FAILURE.has(state) ? 'failure' : 'observation',
      });
    }
  }
  return out;
}

function historicalExamples() {
  const indexFile = path.join(ROOT,'docs/agents/historical-action-errors/index.json');
  const recordsDir = path.join(ROOT,'docs/agents/historical-action-errors/records');
  const index = readJson(indexFile, null);
  if (!index || !fs.existsSync(recordsDir)) return [];
  const ids = [...new Set(Object.values(index.byFingerprint ?? {}).flat().concat(Object.values(index.byNormalized ?? {}).flat()))];
  const out = [];
  for (const id of ids.slice(-2500)) {
    if (typeof id !== 'string') continue;
    const r = readJson(path.join(recordsDir,id+'.json'),null);
    if (!r) continue;
    const strategyId = norm(r.solution?.strategyId ?? r.strategyId ?? r.strategy ?? r.rule);
    if (!STRATEGIES.includes(strategyId)) continue;
    const state = norm(r.outcome ?? r.verification);
    out.push({
      source:'historical-actions',
      fingerprint:String(r.fingerprint ?? sha256(r.normalized ?? id)),
      rootCause:norm(r.rootCause ?? r.class ?? 'unknown'),
      features:Array.isArray(r.features)?r.features.map(norm):[],
      failedSha:r.failedSha ?? r.provenance?.failedSha ?? null,
      targetSha:r.targetSha ?? r.provenance?.targetSha ?? null,
      at:r.at ?? r.createdAt ?? null,
      strategyId,
      outcome:SUCCESS.has(state)?'success':FAILURE.has(state)?'failure':'observation',
    });
  }
  return out;
}

function negativeExamples(memory) {
  const out=[];
  for (const x of memory.antiLessons ?? []) {
    const strategyId=norm(x.rule);
    if (STRATEGIES.includes(strategyId)) out.push({source:'anti-lesson',fingerprint:String(x.fingerprint ?? sha256(JSON.stringify(x))),rootCause:norm(x.rootCause),strategyId,outcome:'failure',features:[]});
  }
  for (const x of memory.actionHistory ?? []) {
    for (const strategyId of x.rejectedStrategies ?? []) {
      if (STRATEGIES.includes(norm(strategyId))) out.push({source:'rejected-history',fingerprint:String(x.fingerprint),rootCause:norm(x.rootCause),strategyId:norm(strategyId),outcome:'failure',features:[]});
    }
  }
  return out;
}

function dedupe(rows) {
  const seen=new Set(); const out=[];
  for(const row of rows){
    const key=[row.source,row.fingerprint,row.strategyId,row.outcome].join('|');
    if(seen.has(key)) continue;
    seen.add(key); out.push(row);
  }
  return out;
}

function split(rows) {
  const train=[], test=[];
  for(const row of rows){
    const bucket=parseInt(sha256(row.fingerprint).slice(0,2),16)%10;
    (bucket<8?train:test).push(row);
  }
  return {train,test};
}

function fit(rows) {
  const cells=new Map();
  for(const row of rows){
    if(row.outcome==='observation') continue;
    const key=row.rootCause+'|'+row.strategyId;
    const cell=cells.get(key) ?? {rootCause:row.rootCause,strategyId:row.strategyId,success:0,failure:0};
    if(row.outcome==='success') cell.success+=1; else cell.failure+=1;
    cells.set(key,cell);
  }
  const byRootCause={}; const global={};
  for(const id of STRATEGIES){
    const relevant=[...cells.values()].filter(x=>x.strategyId===id);
    const success=relevant.reduce((n,x)=>n+x.success,0), failure=relevant.reduce((n,x)=>n+x.failure,0), total=success+failure;
    global[id]={success,failure,observations:total,successRate:total?Number(((success+1)/(total+2)).toFixed(4)):0,trained:total>=2};
  }
  for(const cell of cells.values()){
    const total=cell.success+cell.failure;
    const item={strategyId:cell.strategyId,success:cell.success,failure:cell.failure,observations:total,successRate:Number(((cell.success+1)/(total+2)).toFixed(4)),confidence:Number(Math.min(.98,.45+Math.min(.35,total/20)+Math.min(.18,Math.max(0,cell.success-cell.failure)/20)).toFixed(4))};
    (byRootCause[cell.rootCause] ??= []).push(item);
  }
  for(const list of Object.values(byRootCause)) list.sort((a,b)=>b.successRate-a.successRate||b.observations-a.observations||a.strategyId.localeCompare(b.strategyId));
  return {byRootCause,global};
}

function predict(policy,row){
  const list=policy.byRootCause[norm(row.rootCause)] ?? [];
  if(list.length) return list[0].strategyId;
  return [...STRATEGIES].sort((a,b)=>(policy.global[b]?.successRate??0)-(policy.global[a]?.successRate??0)||a.localeCompare(b))[0];
}

function evaluate(policy,test){
  const positives=test.filter(x=>x.outcome==='success');
  const negatives=test.filter(x=>x.outcome==='failure');
  let hits=0, avoided=0;
  for(const row of positives) if(predict(policy,row)===row.strategyId) hits++;
  for(const row of negatives) if(predict(policy,row)!==row.strategyId) avoided++;
  return {
    positiveCases:positives.length,
    positiveHits:hits,
    accuracy:Number((hits/Math.max(1,positives.length)).toFixed(4)),
    negativeCases:negatives.length,
    negativeAvoidance:negatives.length?Number((avoided/negatives.length).toFixed(4)):null
  };
}

function buildBehaviorExamples(rows) {
  const grouped=new Map();
  const sequenceRows=rows.filter((row)=>row.source==='verified-repair-memory'||row.source==='historical-actions');
  for(const row of sequenceRows){
    const key=[row.fingerprint,row.rootCause].join('|');
    const list=grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key,list);
  }
  const out=[];
  for(const list of grouped.values()){
    list.sort((a,b)=>String(a.at??'').localeCompare(String(b.at??'')));
    let previousStrategy='START';
    for(const row of list){
      out.push({
        fingerprint:row.fingerprint,
        rootCause:row.rootCause,
        features:row.features ?? [],
        previousStrategy,
        strategyId:row.strategyId,
        outcome:row.outcome,
        reward:row.outcome==='success' ? 3 : row.outcome==='failure' ? -2 : 0,
      });
      previousStrategy=row.strategyId;
    }
  }
  return out;
}

function fitBehaviorModel(examples,epochs=5){
  const cells=new Map();
  for(let epoch=0;epoch<epochs;epoch++){
    for(const row of examples){
      if(row.outcome==='observation') continue;
      const key=[row.rootCause,row.previousStrategy,row.strategyId].join('|');
      const cell=cells.get(key) ?? {rootCause:row.rootCause,previousStrategy:row.previousStrategy,strategyId:row.strategyId,reward:0,success:0,failure:0,observations:0};
      cell.reward += row.reward*(1+epoch*0.1);
      cell.observations += 1;
      if(row.outcome==='success') cell.success += 1; else cell.failure += 1;
      cells.set(key,cell);
    }
  }
  const transitions={};
  for(const cell of cells.values()){
    const total=cell.success+cell.failure;
    const quality=(cell.reward/Math.max(1,cell.observations*3)+1)/2;
    const candidate={strategyId:cell.strategyId,reward:Number(cell.reward.toFixed(3)),success:cell.success,failure:cell.failure,observations:total,quality:Number(Math.max(0,Math.min(1,quality)).toFixed(4))};
    const key=[cell.rootCause,cell.previousStrategy].join('|');
    (transitions[key] ??= []).push(candidate);
  }
  for(const list of Object.values(transitions)) list.sort((a,b)=>b.quality-a.quality||b.reward-a.reward||b.observations-a.observations||a.strategyId.localeCompare(b.strategyId));
  return {epochs,transitions};
}

function predictBehavior(model,{rootCause='unknown',previousStrategy='START',rejected=[]}={}){
  const list=model?.transitions?.[[norm(rootCause),norm(previousStrategy)].join('|')] ?? [];
  return list.find((item)=>!rejected.includes(item.strategyId)) ?? null;
}

function featureSignature(features = []) {
  return [...new Set((features ?? []).map(norm).filter(Boolean))].sort().join(',');
}

function attemptBucket(attempt = 0) {
  const n = Math.max(0, Number(attempt) || 0);
  return n === 0 ? 'A0' : n === 1 ? 'A1' : n <= 3 ? 'A2_3' : n <= 7 ? 'A4_7' : 'A8_PLUS';
}

function buildStateExamples(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = [row.fingerprint, row.rootCause].join('|');
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const states = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
    let previousStrategy = 'START';
    list.forEach((row, index) => {
      states.push({
        fingerprint: row.fingerprint,
        rootCause: norm(row.rootCause),
        featureSignature: featureSignature(row.features),
        attemptBucket: attemptBucket(index),
        previousStrategy,
        strategyId: row.strategyId,
        outcome: row.outcome,
        reward: row.outcome === 'success' ? 4 : row.outcome === 'failure' ? -3 : 0,
      });
      previousStrategy = row.strategyId;
    });
  }
  return states;
}

function stateKey(state) {
  return [norm(state.rootCause), norm(state.featureSignature), norm(state.attemptBucket), norm(state.previousStrategy)].join('|');
}

function trainStatePolicy(examples, epochs = 8) {
  const q = new Map();
  const visits = new Map();
  const alpha = 0.22;
  const gamma = 0.78;
  const learningRate = 1 / Math.max(1, epochs);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const row of examples) {
      if (row.outcome === 'observation') continue;
      const key = stateKey(row);
      const qKey = key + '|' + row.strategyId;
      const old = Number(q.get(qKey) ?? 0);
      const shapedReward = row.reward * (1 + epoch * learningRate * 0.25);
      q.set(qKey, old + alpha * (shapedReward - old));
      visits.set(key, Number(visits.get(key) ?? 0) + 1);
    }
  }
  const policy = {};
  for (const [qKey, value] of q.entries()) {
    const parts = qKey.split('|');
    const strategyId = parts.pop();
    const key = parts.join('|');
    const item = { strategyId, qValue: Number(value.toFixed(4)), visits: Number(visits.get(key) ?? 0) };
    (policy[key] ??= []).push(item);
  }
  for (const list of Object.values(policy)) {
    list.sort((a, b) => b.qValue - a.qValue || b.visits - a.visits || a.strategyId.localeCompare(b.strategyId));
  }
  return { schemaVersion: 1, algorithm: 'TABULAR_STATE_ACTION_Q', epochs, alpha, gamma, policy };
}

function predictStatePolicy(model, { rootCause = 'unknown', features = [], attempt = 0, previousStrategy = 'START', rejected = [] } = {}) {
  const exact = [norm(rootCause), featureSignature(features), attemptBucket(attempt), norm(previousStrategy)].join('|');
  const fallbacks = [
    exact,
    [norm(rootCause), featureSignature(features), 'A0', norm(previousStrategy)].join('|'),
    [norm(rootCause), '', attemptBucket(attempt), norm(previousStrategy)].join('|'),
    [norm(rootCause), '', '', norm(previousStrategy)].join('|'),
  ];
  for (const key of fallbacks) {
    const candidate = (model?.policy?.[key] ?? []).find((item) => !rejected.includes(item.strategyId));
    if (candidate) return { ...candidate, stateKey: key };
  }
  return null;
}

function evaluateStatePolicy(model, examples) {
  const scored = examples.filter((row) => row.outcome === 'success' || row.outcome === 'failure');
  let successHits = 0;
  let successCases = 0;
  let failuresAvoided = 0;
  let failureCases = 0;
  for (const row of scored) {
    const prediction = predictStatePolicy(model, row);
    if (row.outcome === 'success') {
      successCases += 1;
      if (prediction?.strategyId === row.strategyId) successHits += 1;
    } else {
      failureCases += 1;
      if (prediction?.strategyId !== row.strategyId) failuresAvoided += 1;
    }
  }
  return {
    cases: scored.length,
    successCases,
    successAccuracy: Number((successHits / Math.max(1, successCases)).toFixed(4)),
    failureCases,
    failureAvoidance: Number((failuresAvoided / Math.max(1, failureCases)).toFixed(4)),
  };
}

function buildAdversarialTrainingSet(rows) {
  const verified=rows.filter((row)=>row.outcome==='success'||row.outcome==='failure');
  const out=[];
  for(const row of verified){
    const alternateFeatures=[...(row.features??[]),row.rootCause==='external-tooling'?'provider':'context-shift'].filter(Boolean);
    out.push({
      ...row,
      variant:'CONTEXT_SHIFT',
      features:[...new Set(alternateFeatures)],
      reward:row.outcome==='success'?2:-2,
    });
    if(row.previousStrategy && row.previousStrategy!=='START'){
      out.push({
        ...row,
        variant:'REPEATED_ACTION_TRAP',
        previousStrategy:row.strategyId,
        reward:row.outcome==='success'?1:-3,
      });
    }
  }
  return out;
}

function trainAdversarialPolicy(examples,epochs=6){
  const cells=new Map();
  for(let epoch=0;epoch<epochs;epoch++){
    for(const row of examples){
      const key=[row.rootCause,featureSignature(row.features),row.previousStrategy].join('|');
      const action=row.strategyId;
      const id=key+'|'+action;
      const cell=cells.get(id) ?? {key,action,reward:0,observations:0};
      cell.reward += row.reward*(1-(epoch/(epochs*2)));
      cell.observations += 1;
      cells.set(id,cell);
    }
  }
  const policy={};
  for(const cell of cells.values()){
    const candidate={strategyId:cell.action,score:Number((cell.reward/Math.max(1,cell.observations)).toFixed(4)),observations:cell.observations};
    (policy[cell.key] ??= []).push(candidate);
  }
  for(const list of Object.values(policy)) list.sort((a,b)=>b.score-a.score||b.observations-a.observations||a.strategyId.localeCompare(b.strategyId));
  return {schemaVersion:1,algorithm:'ADVERSARIAL_CONTEXT_REPLAY',epochs,policy};
}

function evaluateAdversarial(model,examples){
  let correct=0,total=0;
  for(const row of examples){
    const predicted=model.policy[[row.rootCause,featureSignature(row.features),row.previousStrategy].join('|')]?.[0]?.strategyId;
    if(row.outcome==='success'){
      total+=1;
      if(predicted===row.strategyId) correct+=1;
    } else if(predicted && predicted!==row.strategyId){
      correct+=1;
      total+=1;
    }
  }
  return {cases:total,score:Number((correct/Math.max(1,total)).toFixed(4))};
}

function masteryProfile({ rows, behaviorEvaluation, stateEvaluation }) {
  const verified = rows.filter((row) => row.outcome === 'success' || row.outcome === 'failure');
  const counts = Object.fromEntries(CURRICULUM.map(([, skill]) => [skill, 0]));
  for (const row of verified) {
    if (row.outcome === 'success') {
      counts.strategy_selection += 1;
      counts.regression += 1;
      counts.closure += 1;
    } else {
      counts.negative_learning += 1;
      counts.recurrence += 1;
    }
    if (row.rootCause === 'external-tooling') counts.external_isolation += 1;
    if (row.features.includes('typescript') || row.features.includes('lint') || row.features.includes('format')) {
      counts.root_cause += 1;
      counts.hypothesis += 1;
    }
  }
  const competence = {
    exact_sha: Math.min(1, verified.length / 10),
    root_cause: Math.min(1, counts.root_cause / 8),
    hypothesis: Math.min(1, counts.hypothesis / 8),
    strategy_selection: stateEvaluation.successAccuracy,
    negative_learning: stateEvaluation.failureAvoidance,
    external_isolation: counts.external_isolation ? 1 : 0,
    minimal_repair: behaviorEvaluation.successAccuracy,
    regression: counts.regression ? 1 : 0,
    recurrence: counts.recurrence ? 1 : 0,
    closure: counts.closure ? 1 : 0,
  };
  const average = Object.values(competence).reduce((sum, value) => sum + value, 0) / Object.values(competence).length;
  return { sampleCounts: counts, competence, overall: Number(average.toFixed(4)) };
}

function evaluateBehavior(model,examples){
  const scored=examples.filter((x)=>x.outcome==='success'||x.outcome==='failure');
  let hit=0,avoid=0,pos=0,neg=0;
  for(const row of scored){
    const p=predictBehavior(model,{rootCause:row.rootCause,previousStrategy:row.previousStrategy,rejected:[]});
    if(row.outcome==='success'){pos+=1;if(p?.strategyId===row.strategyId)hit+=1;}
    else {neg+=1;if(p?.strategyId!==row.strategyId)avoid+=1;}
  }
  return {cases:scored.length,successCases:pos,successHits:hit,successAccuracy:Number((hit/Math.max(1,pos)).toFixed(4)),failureCases:neg,failureAvoidance:Number((avoid/Math.max(1,neg)).toFixed(4))};
}

export function trainRepairBot({memory=readJson(MEMORY,{cases:[],playbooks:[],lessons:[],antiLessons:[],actionHistory:[]}),log='',diagnosis=readJson(DIAGNOSIS,null)}={}) {
  const rows=dedupe([...memoryExamples(memory),...historicalExamples(),...negativeExamples(memory)]);
  const {train,test}=split(rows);
  const policy=fit(train);
  const evaluation=evaluate(policy,test);
  const rootCause=norm(diagnosis?.rootCause ?? 'unknown');
  const preferred=policy.byRootCause[rootCause]?.[0] ?? null;
  const sufficient=train.length>=8;
  const behaviorRows=buildBehaviorExamples(rows);
  const {train:behaviorTrain,test:behaviorTest}=split(behaviorRows);
  const behaviorModel=fitBehaviorModel(behaviorTrain,5);
  const behaviorEvaluation=evaluateBehavior(behaviorModel,behaviorTest);
  const stateRows=buildStateExamples(rows);
  const {train:stateTrain,test:stateTest}=split(stateRows);
  const stateModel=trainStatePolicy(stateTrain,8);
  const stateEvaluation=evaluateStatePolicy(stateModel,stateTest);
  const adversarialRows=buildAdversarialTrainingSet(stateRows);
  const {train:adversarialTrain,test:adversarialTest}=split(adversarialRows);
  const adversarialModel=trainAdversarialPolicy(adversarialTrain,6);
  const adversarialEvaluation=evaluateAdversarial(adversarialModel,adversarialTest);
  const mastery=masteryProfile({rows,behaviorEvaluation,stateEvaluation});
  const stateCompetent=stateEvaluation.successAccuracy>=.65 && stateEvaluation.failureAvoidance>=.60;
  const adversarialCompetent=adversarialEvaluation.score>=.60;
  const competent=evaluation.accuracy>=.70 && (evaluation.negativeAvoidance==null || evaluation.negativeAvoidance>=.60) && stateCompetent && adversarialCompetent && mastery.overall>=.65;
  return {
    schemaVersion:1,
    protocol:'FLIXO-REPAIR-BOT-BEHAVIORAL-TRAINING-v1',
    authority:'TRAINING_ONLY',
    targetSha:process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? null,
    currentFailureFingerprint:fingerprintFailure(String(log ?? '')) || null,
    currentRootCause:rootCause,
    dataset:{
      total:rows.length,train:train.length,evaluation:test.length,
      sources:[...new Set(rows.map(x=>x.source))],
      positiveExamples:rows.filter(x=>x.outcome==='success').length,
      negativeExamples:rows.filter(x=>x.outcome==='failure').length
    },
    curriculum:CURRICULUM.map(([id,skill])=>{ const score=Number(mastery.competence[skill]??0); return {id,skill,status:score>=.65?'MASTERED':score>0?'TRAINING':'UNSEEN',score,evidenceSource:score>=.65?'VERIFIED_OUTCOMES':'REPLAY_OR_MISSING_DATA'}; }),
    policy,
    behaviorModel,
    behaviorEvaluation,
    stateModel,
    stateEvaluation,
    adversarialModel,
    adversarialEvaluation,
    mastery,
    evaluation,
    decision:{
      mode:sufficient&&competent?'TRAINED_POLICY':rows.length?'BOOTSTRAP_POLICY':'CURRICULUM_ONLY',
      competent,sufficient,
      eligibilityChecks:{datasetSize:rows.length>=8,policyAccuracy:evaluation.accuracy>=.70,negativeAvoidance:evaluation.negativeAvoidance==null||evaluation.negativeAvoidance>=.60,stateAction:stateCompetent,adversarial:adversarialCompetent,mastery:mastery.overall>=.65},
      eligibleToInfluenceRouting:rows.length>=8 && competent,
      behavioralTraining:{epochs:5,trainedExamples:behaviorTrain.length,evaluationExamples:behaviorTest.length,competent:behaviorEvaluation.successAccuracy>=.65 && behaviorEvaluation.failureAvoidance>=.60},
      stateActionTraining:{algorithm:'TABULAR_STATE_ACTION_Q',epochs:8,trainedExamples:stateTrain.length,evaluationExamples:stateTest.length,competent:stateEvaluation.successAccuracy>=.65 && stateEvaluation.failureAvoidance>=.60},
      adversarialTraining:{algorithm:'ADVERSARIAL_CONTEXT_REPLAY',epochs:6,trainedExamples:adversarialTrain.length,evaluationExamples:adversarialTest.length,score:adversarialEvaluation.score,competent:adversarialEvaluation.score>=.60},
      masteryThreshold:0.65,
      masteryOverall:mastery.overall,
      rule:'TRAINING_INFLUENCES_SELECTION_BUT_NEVER_GRANTS_MUTATION_OR_GREEN_AUTHORITY'
    },
    preferredStrategy:preferred,
    trainingObjectives:[
      'ROOT_CAUSE_IDENTIFICATION','EVIDENCE_DRIVEN_ACTION_SELECTION','SUCCESS_AND_FAILURE_LEARNING','TRAINING_GRADUATION',
      'ANTI_LESSON_AVOIDANCE','BEHAVIORAL_SEQUENCE_LEARNING','STATE_ACTION_LEARNING','FEEDBACK_REWARD_LEARNING','COUNTERFACTUAL_AVOIDANCE','EXTERNAL_FAILURE_SEPARATION','FRESH_EXACT_SHA_VERIFICATION'
    ]
  };
}

export function writeTrainingReport(report,output=OUTPUT){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\\n');
}

if(import.meta.url===new URL(process.argv[1]??'','file:').href){
  if(process.argv.includes('--self-test')){
    const sample={cases:[{fingerprint:'training-case-a',rootCause:'lint',features:['lint'],outcomes:[
      {outcome:'success',provenance:{strategyId:'reproduce-exact'}},
      {outcome:'failure',provenance:{strategyId:'minimize-failure'}}
    ]}],playbooks:[],lessons:[],antiLessons:[],actionHistory:[]};
    const report=trainRepairBot({memory:sample,log:''});
    if(report.authority!=='TRAINING_ONLY'||!report.dataset.total||!report.policy.global['reproduce-exact']) throw new Error('REPAIR_BOT_TRAINING_SELF_TEST_FAILED');
    console.log('REPAIR_BOT_TRAINING_SELF_TEST=PASS');
    process.exit(0);
  }
  const report=trainRepairBot({log:fs.existsSync(FAILURE_LOG)?fs.readFileSync(FAILURE_LOG,'utf8'):''});
  writeTrainingReport(report);
  console.log(JSON.stringify({protocol:report.protocol,mode:report.decision.mode,dataset:report.dataset,evaluation:report.evaluation,preferredStrategy:report.preferredStrategy,targetSha:report.targetSha},null,2));
}
