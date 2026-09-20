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
const BASELINE_TRAINING = process.env.FLIXO_REPAIR_TRAINING_BASELINE_PATH ?? path.join(ROOT, 'diagnostics/auto-repair/training-state.json');

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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const hashObject = (value) => sha256(canonicalJson(value));
const verifiedOutcome = (row) => row.outcome === 'success' || row.outcome === 'failure';

function recurrenceIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const key = [row.fingerprint, row.rootCause].join('|');
    const cell = index.get(key) ?? { fingerprint: row.fingerprint, rootCause: row.rootCause, total: 0, successes: 0, failures: 0, verified: 0 };
    cell.total += 1;
    if (row.outcome === 'success') cell.successes += 1;
    if (row.outcome === 'failure') cell.failures += 1;
    if (verifiedOutcome(row)) cell.verified += 1;
    index.set(key, cell);
  }
  return index;
}

function experiencePriority(row, recurrenceCell) {
  const sourceScore = row.source === 'verified-repair-memory' || row.source === 'historical-actions' ? 1 : row.source === 'anti-lesson' || row.source === 'rejected-history' ? 0.85 : 0.5;
  const outcomeScore = row.outcome === 'success' ? 1 : row.outcome === 'failure' ? 0.95 : 0.35;
  const provenanceScore = row.failedSha && row.targetSha ? 1 : 0.7;
  const ambiguityPenalty = row.rootCause === 'unknown' ? 0.35 : 0;
  const repetition = Math.min(1, Math.max(0, (recurrenceCell?.total ?? 1) - 1) / 4);
  const novelty = 1 / Math.max(1, recurrenceCell?.total ?? 1);
  return Number(Math.max(0, Math.min(1, sourceScore * 0.30 + outcomeScore * 0.25 + provenanceScore * 0.20 + repetition * 0.15 + novelty * 0.10 - ambiguityPenalty)).toFixed(5));
}

function buildPrioritizedReplay(rows) {
  const index = recurrenceIndex(rows);
  return rows.map((row) => ({ ...row, replayPriority: experiencePriority(row, index.get([row.fingerprint, row.rootCause].join('|'))) }))
    .sort((a, b) => b.replayPriority - a.replayPriority || a.fingerprint.localeCompare(b.fingerprint) || a.strategyId.localeCompare(b.strategyId));
}

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

export function buildGoldenReplaySet(rows) {
  return rows
    .filter((row) => verifiedOutcome(row) && parseInt(sha256(row.fingerprint).slice(0, 2), 16) % 3 === 0)
    .slice(0, 200);
}

export function partitionTrainingRows(rows) {
  const goldenRows = buildGoldenReplaySet(rows);
  const goldenFingerprints = new Set(goldenRows.map((row) => row.fingerprint));
  const trainableRows = rows.filter((row) => !goldenFingerprints.has(row.fingerprint));
  const { train, test } = split(trainableRows);
  return {
    goldenRows,
    trainableRows,
    train,
    test,
    goldenFingerprintCount: goldenFingerprints.size,
    leakageOverlap: trainableRows.filter((row) => goldenFingerprints.has(row.fingerprint)).length,
  };
}

function buildExperienceLedger(rows) {
  const ids = rows
    .map((row) => hashObject({
      source: row.source,
      fingerprint: row.fingerprint,
      rootCause: row.rootCause,
      strategyId: row.strategyId,
      outcome: row.outcome,
      failedSha: row.failedSha ?? null,
      targetSha: row.targetSha ?? null,
    }))
    .sort();
  return {
    algorithm: 'VERIFIED_EXPERIENCE_LEDGER-v1',
    count: ids.length,
    ids,
    hash: hashObject(ids),
  };
}

function fit(rows) {
  const cells=new Map();
  for(const row of rows){
    if(!verifiedOutcome(row)) continue;
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
  const sequenceRows = rows.filter((row) => row.source === 'verified-repair-memory' || row.source === 'historical-actions');
  for (const row of sequenceRows) {
    const key = [row.fingerprint, row.rootCause].join('|');
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const states = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
    let previousStrategy = 'START';
    const sequence = list.map((row, index) => ({
      fingerprint: row.fingerprint,
      rootCause: norm(row.rootCause),
      featureSignature: featureSignature(row.features),
      attemptBucket: attemptBucket(index),
      previousStrategy,
      strategyId: row.strategyId,
      outcome: row.outcome,
      reward: row.outcome === 'success' ? 4 : row.outcome === 'failure' ? -3 : 0,
      terminal: index === list.length - 1 || row.outcome === 'success',
    }));
    for (let index = 0; index < sequence.length; index += 1) {
      const current = sequence[index];
      const next = sequence[index + 1];
      states.push({ ...current, nextStateKey: current.terminal || !next ? null : stateKey(next) });
      previousStrategy = current.strategyId;
    }
  }
  return states;
}

function stateKey(state) {
  return [norm(state.rootCause), norm(state.featureSignature), norm(state.attemptBucket), norm(state.previousStrategy)].join('|');
}

function maxQForState(q, statePrefix) {
  let max = 0;
  for (const [qKey, value] of q.entries()) {
    if (qKey.startsWith(statePrefix + '|')) max = Math.max(max, Number(value) || 0);
  }
  return max;
}

function trainStatePolicy(examples, epochs = 8) {
  const q = new Map();
  const visits = new Map();
  const alpha = 0.22;
  const gamma = 0.78;
  const replay = buildPrioritizedReplay(examples);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const row of replay) {
      if (!verifiedOutcome(row)) continue;
      const key = stateKey(row);
      const qKey = key + '|' + row.strategyId;
      const old = Number(q.get(qKey) ?? 0);
      const priorityWeight = 0.75 + Number(row.replayPriority ?? 0.5) * 0.5;
      const shapedReward = row.reward * priorityWeight;
      const bootstrap = row.terminal || !row.nextStateKey ? 0 : gamma * maxQForState(q, row.nextStateKey);
      const target = shapedReward + bootstrap;
      q.set(qKey, old + alpha * (target - old));
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
  for (const list of Object.values(policy)) list.sort((a, b) => b.qValue - a.qValue || b.visits - a.visits || a.strategyId.localeCompare(b.strategyId));
  return { schemaVersion: 2, algorithm: 'TABULAR_STATE_ACTION_Q', update: 'BELLMAN_BOOTSTRAPPED_STATE_TRANSITIONS', epochs, alpha, gamma, prioritizedReplay: true, policy };
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

function masteryProfile({ rows, behaviorEvaluation, stateEvaluation, calibration, recurrence }) {
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
    exact_sha: Math.min(1, verified.filter((row) => row.failedSha && row.targetSha).length / 10),
    root_cause: Math.min(1, counts.root_cause / 8),
    hypothesis: Math.min(1, counts.hypothesis / 8),
    strategy_selection: stateEvaluation.successAccuracy,
    negative_learning: stateEvaluation.failureAvoidance,
    external_isolation: counts.external_isolation ? 1 : 0,
    minimal_repair: behaviorEvaluation.successAccuracy,
    regression: counts.regression ? 1 : 0,
    recurrence: recurrence.overallRisk === 'LOW' ? 1 : recurrence.overallRisk === 'MEDIUM' ? 0.70 : 0.45,
    closure: counts.closure ? 1 : 0,
    evidence_ranking: calibration.expectedCalibrationError == null ? 0 : Math.max(0, 1 - calibration.expectedCalibrationError),
    recurrence_prevention: recurrence.highestRisk?.risk === 'HIGH' ? 0.45 : 1,
  };
  const average = Object.values(competence).reduce((sum, value) => sum + value, 0) / Object.values(competence).length;
  return { sampleCounts: counts, competence, overall: Number(average.toFixed(4)) };
}

function buildCounterfactualExamples(rows) {
  const rejectedByCase = new Map();
  for (const row of rows) {
    if (row.source !== 'anti-lesson' && row.source !== 'rejected-history') continue;
    const key = [row.fingerprint, row.rootCause].join('|');
    const set = rejectedByCase.get(key) ?? new Set();
    set.add(row.strategyId);
    rejectedByCase.set(key, set);
  }
  const out = [];
  for (const row of rows) {
    if ((row.source !== 'verified-repair-memory' && row.source !== 'historical-actions') || row.outcome !== 'success') continue;
    const rejected = rejectedByCase.get([row.fingerprint, row.rootCause].join('|')) ?? new Set();
    for (const strategyId of rejected) {
      if (strategyId === row.strategyId || !STRATEGIES.includes(strategyId)) continue;
      out.push({ ...row, source: 'counterfactual', strategyId, previousStrategy: row.strategyId, outcome: 'counterfactual', counterfactualOf: row.strategyId, counterfactualReason: 'EXPLICITLY_REJECTED_STRATEGY_FROM_DURABLE_MEMORY', reward: -4 });
    }
  }
  return out;
}

function trainCounterfactualModel(examples) {
  const policy = {};
  for (const row of examples) {
    const key = [row.rootCause, featureSignature(row.features), row.previousStrategy].join('|');
    (policy[key] ??= []).push({ strategyId: row.strategyId, penalty: 4, observations: 1, source: row.source });
  }
  for (const list of Object.values(policy)) list.sort((a, b) => b.penalty - a.penalty || a.strategyId.localeCompare(b.strategyId));
  return { schemaVersion: 1, algorithm: 'EVIDENCE_BACKED_COUNTERFACTUAL_REJECTION', policy, cases: examples.length };
}

function predictPolicyWithConfidence(policy, row) {
  const contextual = policy?.byRootCause?.[norm(row.rootCause)] ?? [];
  const global = policy?.global ?? {};
  const candidates = (contextual.length ? contextual : Object.entries(global).map(([strategyId, value]) => ({ strategyId, ...value }))).slice();
  candidates.sort((a, b) => Number(b.successRate ?? 0) - Number(a.successRate ?? 0) || a.strategyId.localeCompare(b.strategyId));
  const candidate = candidates[0] ?? null;
  return { strategyId: candidate?.strategyId ?? null, confidence: Number(Math.max(0, Math.min(1, Number(candidate?.successRate ?? 0))).toFixed(4)) };
}

function calibratePolicy(policy, testRows) {
  const scored = testRows.filter(verifiedOutcome);
  const buckets = [];
  for (let bucket = 0; bucket < 5; bucket += 1) {
    const lower = bucket / 5;
    const upper = (bucket + 1) / 5;
    const rows = scored.filter((row) => {
      const confidence = predictPolicyWithConfidence(policy, row).confidence;
      return confidence >= lower && (bucket === 4 ? confidence <= upper : confidence < upper);
    });
    if (!rows.length) continue;
    const accuracy = rows.filter((row) => {
      const prediction = predictPolicyWithConfidence(policy, row);
      return row.outcome === 'success' ? prediction.strategyId === row.strategyId : prediction.strategyId !== row.strategyId;
    }).length / rows.length;
    buckets.push({ lower, upper, observations: rows.length, meanConfidence: Number((rows.reduce((sum, row) => sum + predictPolicyWithConfidence(policy, row).confidence, 0) / rows.length).toFixed(4)), accuracy: Number(accuracy.toFixed(4)) });
  }
  const total = scored.length;
  const ece = total ? buckets.reduce((sum, bucket) => sum + Math.abs(bucket.meanConfidence - bucket.accuracy) * bucket.observations, 0) / total : null;
  const thresholds = [0.45, 0.55, 0.65, 0.70, 0.75, 0.80, 0.85];
  const candidates = thresholds.map((threshold) => {
    const active = scored.filter((row) => predictPolicyWithConfidence(policy, row).confidence >= threshold);
    const positives = active.filter((row) => row.outcome === 'success');
    const negatives = active.filter((row) => row.outcome === 'failure');
    const successAccuracy = positives.length ? positives.filter((row) => predictPolicyWithConfidence(policy, row).strategyId === row.strategyId).length / positives.length : 1;
    const failureAvoidance = negatives.length ? negatives.filter((row) => predictPolicyWithConfidence(policy, row).strategyId !== row.strategyId).length / negatives.length : 1;
    return { threshold, activeCases: active.length, abstainedCases: scored.length - active.length, successAccuracy: Number(successAccuracy.toFixed(4)), failureAvoidance: Number(failureAvoidance.toFixed(4)) };
  });
  const admissible = candidates.filter((item) => item.successAccuracy >= 0.70 && item.failureAvoidance >= 0.60);
  return { algorithm: 'EMPIRICAL_BUCKET_CALIBRATION', expectedCalibrationError: ece == null ? null : Number(ece.toFixed(4)), buckets, abstention: { recommendedThreshold: admissible.sort((a, b) => a.threshold - b.threshold)[0]?.threshold ?? 0.75, rule: 'LOW_CONFIDENCE_OR_AMBIGUOUS_STATE_REQUIRES_MORE_EVIDENCE', candidates } };
}


function evaluatePolicyAgainstRows(policy, rows) {
  let successes = 0, successHits = 0, failures = 0, avoided = 0;
  for (const row of rows) {
    if (!verifiedOutcome(row)) continue;
    const prediction = predictPolicyWithConfidence(policy, row);
    if (row.outcome === 'success') { successes += 1; if (prediction.strategyId === row.strategyId) successHits += 1; }
    else { failures += 1; if (prediction.strategyId !== row.strategyId) avoided += 1; }
  }
  return { cases: successes + failures, successAccuracy: Number((successHits / Math.max(1, successes)).toFixed(4)), failureAvoidance: Number((avoided / Math.max(1, failures)).toFixed(4)) };
}

function antiForgettingCheck(candidatePolicy, baselineReport, goldenRows) {
  const candidate = evaluatePolicyAgainstRows(candidatePolicy, goldenRows);
  if (!goldenRows.length) {
    return { status: 'NO_GOLDEN_CASES', candidate, regression: false, comparable: false };
  }
  if (!baselineReport?.policy && !baselineReport?.activePolicy) {
    return { status: 'NO_BASELINE', candidate, regression: false, comparable: false };
  }
  if (baselineReport?.trainingProvenance?.goldenBenchmarkExcluded !== true) {
    return { status: 'BASELINE_NOT_COMPARABLE', candidate, regression: false, comparable: false };
  }
  const baselinePolicy = baselineReport.activePolicy ?? baselineReport.policy;
  const baseline = evaluatePolicyAgainstRows(baselinePolicy, goldenRows);
  const regression = candidate.successAccuracy + 0.05 < baseline.successAccuracy || candidate.failureAvoidance + 0.05 < baseline.failureAvoidance;
  return { status: regression ? 'REJECT_TRAINING' : 'PASS', candidate, baseline, regression, comparable: true };
}

export function derivePolicyLifecycle({ policy, baselineReport, antiForgetting, goldenRows }) {
  const baselinePolicy = baselineReport?.activePolicy ?? baselineReport?.policy ?? null;
  const candidateHash = hashObject(policy);
  const baselineHash = baselinePolicy ? hashObject(baselinePolicy) : null;
  const rollbackRequired = Boolean(antiForgetting?.regression && baselinePolicy);
  const status = rollbackRequired
    ? 'ROLLBACK_TO_BASELINE'
    : baselinePolicy
      ? antiForgetting?.status === 'BASELINE_NOT_COMPARABLE'
        ? 'PROMOTE_CANDIDATE_REBASELINE_REQUIRED'
        : antiForgetting?.status === 'NO_GOLDEN_CASES'
          ? 'PROMOTE_CANDIDATE_BENCHMARK_PENDING'
          : 'PROMOTE_CANDIDATE'
      : 'BOOTSTRAP_CANDIDATE';
  const activePolicy = rollbackRequired ? baselinePolicy : policy;
  return {
    schemaVersion: 1,
    algorithm: 'POLICY_LIFECYCLE_GUARD-v1',
    status,
    rollbackRequired,
    candidatePolicyHash: candidateHash,
    baselinePolicyHash: baselineHash,
    activePolicyHash: hashObject(activePolicy),
    activePolicySource: rollbackRequired ? 'BASELINE' : 'CANDIDATE',
    benchmark: {
      heldOut: true,
      cases: goldenRows.length,
      candidateEvaluation: antiForgetting?.candidate ?? null,
      regression: Boolean(antiForgetting?.regression),
      comparableBaseline: Boolean(antiForgetting?.comparable),
    },
    routingEligible: !rollbackRequired,
    activePolicy,
  };
}

function buildRecurrenceProfile(rows, focusFingerprint = null) {
  const index = recurrenceIndex(rows);
  const cases = [...index.values()].map((item) => {
    const repeatDensity = Math.min(1, Math.max(0, item.total - 1) / 4);
    const failureDensity = item.verified ? item.failures / item.verified : 0;
    const riskScore = Number(Math.min(1, repeatDensity * 0.55 + failureDensity * 0.45).toFixed(4));
    return { ...item, riskScore, risk: riskScore >= 0.75 ? 'HIGH' : riskScore >= 0.45 ? 'MEDIUM' : 'LOW' };
  }).sort((a, b) => b.riskScore - a.riskScore || b.total - a.total);
  return { algorithm: 'HEURISTIC_RECURRENCE_RISK-v1', cases: cases.slice(0, 100), focused: focusFingerprint ? cases.filter((item) => item.fingerprint === focusFingerprint) : [], highestRisk: cases[0] ?? null, overallRisk: cases.some((item) => item.risk === 'HIGH') ? 'HIGH' : cases.some((item) => item.risk === 'MEDIUM') ? 'MEDIUM' : 'LOW' };
}

function buildRecurrenceExamples(rows) {
  const grouped = new Map();
  for (const row of rows.filter((item) => item.source === 'verified-repair-memory' || item.source === 'historical-actions')) {
    const key = [row.fingerprint, row.rootCause].join('|');
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const out = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
    let previousStrategy = 'START';
    for (let index = 0; index < list.length; index += 1) {
      const row = list[index];
      if (!verifiedOutcome(row)) {
        previousStrategy = row.strategyId;
        continue;
      }
      out.push({
        fingerprint: row.fingerprint,
        rootCause: norm(row.rootCause),
        featureSignature: featureSignature(row.features),
        attemptBucket: attemptBucket(index),
        previousStrategy: norm(previousStrategy),
        strategyId: row.strategyId,
        outcome: row.outcome,
        failureLabel: row.outcome === 'failure' ? 1 : 0,
        repeatedAction: previousStrategy !== 'START' && previousStrategy === row.strategyId,
      });
      previousStrategy = row.strategyId;
    }
  }
  return out;
}

function recurrenceStateKey(row) {
  return [norm(row.rootCause), featureSignature(row.featureSignature ? row.featureSignature.split(',') : []), norm(row.attemptBucket), norm(row.previousStrategy)].join('|');
}

function trainRecurrenceModel(examples) {
  const cells = new Map();
  for (const row of examples) {
    const key = recurrenceStateKey(row);
    const cell = cells.get(key) ?? { failures: 0, successes: 0, repeats: 0, observations: 0 };
    cell.observations += 1;
    if (row.failureLabel === 1) cell.failures += 1;
    else cell.successes += 1;
    if (row.repeatedAction) cell.repeats += 1;
    cells.set(key, cell);
  }
  const model = {};
  for (const [key, cell] of cells.entries()) {
    const total = cell.observations;
    const failureRisk = Number(((cell.failures + 1) / (total + 2)).toFixed(4));
    const repeatRate = Number((cell.repeats / Math.max(1, total)).toFixed(4));
    (model[key] ??= []).push({
      failureRisk,
      repeatRate,
      observations: total,
      confidence: Number(Math.min(0.98, 0.45 + Math.min(0.40, total / 20)).toFixed(4)),
    });
  }
  return {
    schemaVersion: 1,
    algorithm: 'TABULAR_EARLY_RECURRENCE_WARNING-v1',
    threshold: 0.50,
    states: model,
  };
}

function predictRecurrenceRisk(model, row) {
  const keys = [
    recurrenceStateKey(row),
    [norm(row.rootCause), featureSignature(row.features ?? []), 'A0', norm(row.previousStrategy)].join('|'),
    [norm(row.rootCause), '', norm(row.attemptBucket), norm(row.previousStrategy)].join('|'),
    [norm(row.rootCause), '', '', norm(row.previousStrategy)].join('|'),
  ];
  for (const key of keys) {
    const candidate = model?.states?.[key]?.[0];
    if (candidate) return { ...candidate, stateKey: key, warning: candidate.failureRisk >= Number(model.threshold ?? 0.5) };
  }
  return { failureRisk: 0.5, repeatRate: 0, observations: 0, confidence: 0, stateKey: null, warning: false };
}

function evaluateRecurrenceModel(model, examples) {
  const scored = examples.filter((row) => row.outcome === 'success' || row.outcome === 'failure');
  let failures = 0;
  let detectedFailures = 0;
  let successes = 0;
  let preservedSuccesses = 0;
  let correct = 0;
  for (const row of scored) {
    const prediction = predictRecurrenceRisk(model, row);
    if (row.outcome === 'failure') {
      failures += 1;
      if (prediction.warning) detectedFailures += 1;
      if (prediction.warning === (row.outcome === 'failure')) correct += 1;
    } else {
      successes += 1;
      if (!prediction.warning) preservedSuccesses += 1;
      if (prediction.warning === (row.outcome === 'failure')) correct += 1;
    }
  }
  return {
    cases: scored.length,
    accuracy: Number((correct / Math.max(1, scored.length)).toFixed(4)),
    failureDetection: Number((detectedFailures / Math.max(1, failures)).toFixed(4)),
    successPreservation: Number((preservedSuccesses / Math.max(1, successes)).toFixed(4)),
  };
}

function evaluateHeldOutMastery({ evaluationTest, goldenRows, goldenEvaluation, behaviorEvaluation, stateEvaluation, calibration, recurrenceEvaluation }) {
  const verified = [...evaluationTest, ...goldenRows].filter(verifiedOutcome);
  const score = (value, cases = verified.length) => cases > 0 && Number.isFinite(value) ? Number(value.toFixed(4)) : null;
  const passRate = (predicate, rows = verified) => rows.length ? score(rows.filter(predicate).length / rows.length, rows.length) : null;
  const goldenVerified = goldenRows.filter(verifiedOutcome);
  const goldenSha = passRate((row) => row.failedSha && row.targetSha, goldenVerified);
  const goldenRoot = passRate((row) => row.rootCause && row.rootCause !== 'unknown', goldenVerified);
  const goldenHypothesis = passRate((row) => row.rootCause && row.rootCause !== 'unknown' && STRATEGIES.includes(row.strategyId), goldenVerified);
  const goldenClosure = passRate((row) => row.failedSha && row.targetSha && row.strategyId && row.outcome, goldenVerified);
  const external = verified.filter((row) => row.rootCause === 'external-tooling');
  const externalIsolation = external.length ? passRate((row) => row.failedSha && row.targetSha, external) : null;
  const regression = goldenEvaluation?.successAccuracy ?? null;
  const competence = {
    exact_sha: goldenSha,
    root_cause: goldenRoot,
    hypothesis: goldenHypothesis,
    strategy_selection: score((Number(stateEvaluation?.successAccuracy ?? 0) + Number(goldenEvaluation?.successAccuracy ?? 0)) / 2),
    negative_learning: score((Number(stateEvaluation?.failureAvoidance ?? 0) + Number(goldenEvaluation?.failureAvoidance ?? 0)) / 2),
    external_isolation: externalIsolation,
    minimal_repair: score(behaviorEvaluation?.successAccuracy ?? 0),
    regression: regression == null ? null : score(regression),
    recurrence: score(((recurrenceEvaluation?.failureDetection ?? 0) + (recurrenceEvaluation?.successPreservation ?? 0)) / 2, recurrenceEvaluation?.cases ?? 0),
    closure: goldenClosure,
    evidence_ranking: calibration?.expectedCalibrationError == null ? null : score(Math.max(0, 1 - calibration.expectedCalibrationError)),
    recurrence_prevention: score(recurrenceEvaluation?.failureDetection ?? 0, recurrenceEvaluation?.cases ?? 0),
  };
  const observed = Object.values(competence).filter((value) => value != null);
  const overall = observed.length ? Number((observed.reduce((sum, value) => sum + value, 0) / observed.length).toFixed(4)) : 0;
  return {
    schemaVersion: 1,
    algorithm: 'HELD_OUT_SKILL_MASTERY-v1',
    heldOut: true,
    evaluationCases: evaluationTest.length,
    goldenCases: goldenRows.length,
    observedSkills: observed.length,
    competence,
    overall,
    requiredThreshold: 0.65,
  };
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
  const partition = partitionTrainingRows(rows);
  const { goldenRows, trainableRows, train, test } = partition;
  const prioritizedRows=buildPrioritizedReplay(trainableRows);
  const policy=fit(train);
  const evaluation=evaluate(policy,test);
  const rootCause=norm(diagnosis?.rootCause ?? 'unknown');
  const sufficient=train.length>=8;
  const experienceLedger = buildExperienceLedger(trainableRows);
  const behaviorRows=buildBehaviorExamples(trainableRows);
  const {train:behaviorTrain,test:behaviorTest}=split(behaviorRows);
  const behaviorModel=fitBehaviorModel(behaviorTrain,5);
  const behaviorEvaluation=evaluateBehavior(behaviorModel,behaviorTest);
  const stateRows=buildStateExamples(trainableRows);
  const {train:stateTrain,test:stateTest}=split(stateRows);
  const stateModel=trainStatePolicy(stateTrain,8);
  const stateEvaluation=evaluateStatePolicy(stateModel,stateTest);
  const recurrence=buildRecurrenceProfile(trainableRows, fingerprintFailure(String(log ?? '')) || null);
  const recurrenceRows = buildRecurrenceExamples(trainableRows);
  const {train:recurrenceTrain,test:recurrenceTest}=split(recurrenceRows);
  const recurrenceModel = trainRecurrenceModel(recurrenceTrain);
  const recurrenceEvaluation = evaluateRecurrenceModel(recurrenceModel, recurrenceTest);
  const counterfactualRows=buildCounterfactualExamples(trainableRows);
  const adversarialRows=buildAdversarialTrainingSet(stateRows).concat(counterfactualRows.map((row) => ({ ...row, variant:'COUNTERFACTUAL_REPLAY', previousStrategy:row.previousStrategy ?? 'START' })));
  const {train:adversarialTrain,test:adversarialTest}=split(adversarialRows);
  const adversarialModel=trainAdversarialPolicy(adversarialTrain,6);
  const adversarialEvaluation=evaluateAdversarial(adversarialModel,adversarialTest);
  const calibration=calibratePolicy(policy,test);
  const goldenReplay = goldenRows;
  const baselineReport=readJson(BASELINE_TRAINING,null);
  const antiForgetting=antiForgettingCheck(policy,baselineReport,goldenReplay);
  const policyLifecycle = derivePolicyLifecycle({ policy, baselineReport, antiForgetting, goldenRows: goldenReplay });
  const activePolicy = policyLifecycle.activePolicy;
  const preferred=activePolicy.byRootCause[rootCause]?.[0] ?? null;
  const mastery=masteryProfile({rows:trainableRows,behaviorEvaluation,stateEvaluation,calibration,recurrence});
  const goldenEvaluation = evaluatePolicyAgainstRows(policy, goldenReplay);
  const heldOutMastery = evaluateHeldOutMastery({
    evaluationTest: test,
    goldenRows: goldenReplay,
    goldenEvaluation,
    behaviorEvaluation,
    stateEvaluation,
    calibration,
    recurrenceEvaluation,
  });
  const recurrenceCompetent = recurrenceEvaluation.cases === 0
    ? false
    : recurrenceEvaluation.failureDetection >= .60 && recurrenceEvaluation.successPreservation >= .60;
  const heldOutMasteryCompetent = heldOutMastery.overall >= .65 && heldOutMastery.observedSkills >= 6;
  const stateCompetent=stateEvaluation.successAccuracy>=.65 && stateEvaluation.failureAvoidance>=.60;
  const adversarialCompetent=adversarialEvaluation.score>=.60;
  const calibrationCompetent=calibration.expectedCalibrationError==null || calibration.expectedCalibrationError<=.20;
  const antiForgettingCompetent=antiForgetting.status!=='REJECT_TRAINING';
  const competent=evaluation.accuracy>=.70 && (evaluation.negativeAvoidance==null || evaluation.negativeAvoidance>=.60) && stateCompetent && adversarialCompetent && mastery.overall>=.65 && heldOutMasteryCompetent && recurrenceCompetent && calibrationCompetent && antiForgettingCompetent;
  return {
    schemaVersion:1,
    protocol:'FLIXO-REPAIR-BOT-BEHAVIORAL-TRAINING-v1',
    authority:'TRAINING_ONLY',
    targetSha:process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? null,
    currentFailureFingerprint:fingerprintFailure(String(log ?? '')) || null,
    currentRootCause:rootCause,
    dataset:{
      total:rows.length,train:train.length,evaluation:test.length,
      trainable:trainableRows.length,
      heldOutGolden:goldenRows.length,
      goldenFingerprintCount:partition.goldenFingerprintCount,
      goldenLeakageOverlap:partition.leakageOverlap,
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
    counterfactualModel:trainCounterfactualModel(counterfactualRows),
    counterfactualEvaluation:{cases:counterfactualRows.length,sourceIntegrity:counterfactualRows.every((row)=>row.source==='counterfactual')},
    recurrence,
    recurrenceEarlyWarning:{
      model:recurrenceModel,
      evaluation:recurrenceEvaluation,
      heldOut:true,
      competent:recurrenceCompetent,
    },
    calibration,
    goldenReplay:{
      cases:goldenReplay.length,
      excludedFromTraining:true,
      leakageOverlap:partition.leakageOverlap,
      fingerprints:goldenReplay.map((row)=>row.fingerprint).filter((value,index,array)=>array.indexOf(value)===index).slice(0,200),
      evaluation:goldenEvaluation
    },
    heldOutMastery,
    policyLifecycle,
    activePolicy,
    antiForgetting,
    prioritizedReplay:{algorithm:'DETERMINISTIC_PRIORITY_REPLAY-v1',cases:prioritizedRows.length,topCases:prioritizedRows.slice(0,20).map((row)=>({fingerprint:row.fingerprint,rootCause:row.rootCause,strategyId:row.strategyId,outcome:row.outcome,priority:row.replayPriority}))},
    mastery,
    evaluation,
    decision:{
      mode:sufficient&&competent&&policyLifecycle.routingEligible?'TRAINED_POLICY':rows.length?'BOOTSTRAP_POLICY':'CURRICULUM_ONLY',
      competent,sufficient,
      eligibilityChecks:{datasetSize:rows.length>=8,policyAccuracy:evaluation.accuracy>=.70,negativeAvoidance:evaluation.negativeAvoidance==null||evaluation.negativeAvoidance>=.60,stateAction:stateCompetent,adversarial:adversarialCompetent,calibration:calibrationCompetent,antiForgetting:antiForgettingCompetent,mastery:mastery.overall>=.65,heldOutMastery:heldOutMasteryCompetent,recurrenceEarlyWarning:recurrenceCompetent},
      eligibleToInfluenceRouting:rows.length>=8 && competent && policyLifecycle.routingEligible && partition.leakageOverlap===0,
      behavioralTraining:{epochs:5,trainedExamples:behaviorTrain.length,evaluationExamples:behaviorTest.length,competent:behaviorEvaluation.successAccuracy>=.65 && behaviorEvaluation.failureAvoidance>=.60},
      stateActionTraining:{algorithm:'TABULAR_STATE_ACTION_Q',update:stateModel.update,epochs:8,trainedExamples:stateTrain.length,evaluationExamples:stateTest.length,prioritizedReplay:stateModel.prioritizedReplay,competent:stateEvaluation.successAccuracy>=.65 && stateEvaluation.failureAvoidance>=.60},
      adversarialTraining:{algorithm:'ADVERSARIAL_CONTEXT_REPLAY',epochs:6,trainedExamples:adversarialTrain.length,evaluationExamples:adversarialTest.length,score:adversarialEvaluation.score,competent:adversarialEvaluation.score>=.60},
      counterfactualTraining:{algorithm:'EVIDENCE_BACKED_COUNTERFACTUAL_REJECTION',examples:counterfactualRows.length,sourceOnlyFromRejectedMemory:true},
      calibration:{algorithm:calibration.algorithm,ece:calibration.expectedCalibrationError,recommendedAbstentionThreshold:calibration.abstention.recommendedThreshold,competent:calibrationCompetent},
      antiForgetting:{status:antiForgetting.status,regression:antiForgetting.regression,competent:antiForgettingCompetent,goldenReplayCases:goldenReplay.length},
      policyLifecycle:{
        status:policyLifecycle.status,
        rollbackRequired:policyLifecycle.rollbackRequired,
        routingEligible:policyLifecycle.routingEligible,
        candidatePolicyHash:policyLifecycle.candidatePolicyHash,
        activePolicyHash:policyLifecycle.activePolicyHash,
        activePolicySource:policyLifecycle.activePolicySource
      },
      masteryThreshold:0.65,
      masteryOverall:mastery.overall,
      rule:'TRAINING_INFLUENCES_SELECTION_BUT_NEVER_GRANTS_MUTATION_OR_GREEN_AUTHORITY'
    },
    preferredStrategy:preferred,
    trainingObjectives:[
      'ROOT_CAUSE_IDENTIFICATION','EVIDENCE_DRIVEN_ACTION_SELECTION','SUCCESS_AND_FAILURE_LEARNING','TRAINING_GRADUATION',
      'ANTI_LESSON_AVOIDANCE','BEHAVIORAL_SEQUENCE_LEARNING','STATE_ACTION_LEARNING','FEEDBACK_REWARD_LEARNING','COUNTERFACTUAL_AVOIDANCE','EXTERNAL_FAILURE_SEPARATION','FRESH_EXACT_SHA_VERIFICATION',
      'PRIORITIZED_EXPERIENCE_REPLAY','CONFIDENCE_CALIBRATION','ABSTENTION','RECURRENCE_PREDICTION','ANTI_CATASTROPHIC_FORGETTING','SKILL_SPECIFIC_MASTERY',
      'HELD_OUT_GOLDEN_BENCHMARK','CONTINUOUS_EXPERIENCE_LEDGER','POLICY_PROMOTION_GATE','POLICY_ROLLBACK','REPLAYABLE_DECISION_PROVENANCE','EARLY_RECURRENCE_WARNING','HELD_OUT_SKILL_MASTERY'
    ],
    trainingProvenance:{
      targetSha:process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? null,
      datasetHash:hashObject(rows),
      memoryHash:hashObject(memory),
      baselineTrainingPath:BASELINE_TRAINING,
      curriculumHash:hashObject(CURRICULUM),
      policyHash:hashObject(policy),
      statePolicyHash:hashObject(stateModel),
      adversarialPolicyHash:hashObject(adversarialModel),
      counterfactualHash:hashObject(counterfactualRows),
      calibrationHash:hashObject(calibration),
      recurrenceHash:hashObject(recurrence),
      recurrenceModelHash:hashObject(recurrenceModel),
      recurrenceEvaluationHash:hashObject(recurrenceEvaluation),
      heldOutMasteryHash:hashObject(heldOutMastery),
      evaluationHash:hashObject({evaluation,stateEvaluation,adversarialEvaluation,antiForgetting,recurrenceEvaluation,heldOutMastery}),
      goldenBenchmarkHash:hashObject(goldenReplay.map((row)=>row.fingerprint).sort()),
      experienceLedgerHash:experienceLedger.hash,
      experienceIds:experienceLedger.ids,
      goldenBenchmarkExcluded:true,
      activePolicyHash:policyLifecycle.activePolicyHash,
      activePolicySource:policyLifecycle.activePolicySource,
      previousTrainingHash:baselineReport?.trainingProvenance?.policyHash ?? null,
      algorithmVersions:{
        behavioral:'SEQUENCE_TRANSITIONS-v1',
        state:'BELLMAN_BOOTSTRAPPED_STATE_TRANSITIONS-v2',
        replay:'DETERMINISTIC_PRIORITY_REPLAY-v1',
        counterfactual:'EVIDENCE_BACKED_COUNTERFACTUAL_REJECTION-v1',
        calibration:'EMPIRICAL_BUCKET_CALIBRATION-v1',
        recurrence:'HEURISTIC_RECURRENCE_RISK-v1',
        recurrenceEarlyWarning:'TABULAR_EARLY_RECURRENCE_WARNING-v1',
        mastery:'HELD_OUT_SKILL_MASTERY-v1'
      }
    }
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
