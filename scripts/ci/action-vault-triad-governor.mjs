#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ACTION_VAULT_TRIAD_PROTOCOL = 'ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1';
export const RECURRENCE_ESCALATION_THRESHOLD = 20;
export const CATALOG_CAPACITY = 1_000_000;
export const BOTS = Object.freeze(['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3']);

const ROOT = process.cwd();
const VAULT = path.resolve(ROOT, 'diagnostics/auto-repair/action-vault');
const LEDGER = path.join(VAULT, 'failure-ledger.ndjson');
const STATE = path.join(VAULT, 'triad-governor-state.json');
const MISS_LEDGER = path.join(VAULT, 'catalog-misses.ndjson');
const LEARNED = path.join(VAULT, 'learned-advice.ndjson');
const ADVICE_CATALOG = path.join(VAULT, 'advice-catalog.ndjson');
const PRIMARY_ADVICE_INDEX = path.resolve(ROOT, 'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json');

const sha = (v) => crypto.createHash('sha256').update(String(v), 'utf8').digest('hex');
const validSha = (v) => /^[a-f0-9]{40}$/u.test(String(v));
const readText = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const append = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify(value) + '\n'); };

function loadLedger() {
  return readText(LEDGER).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function corpusFiles() {
  const routerPath = path.resolve(ROOT, 'docs/agents/ERROR-TEACHING-ROUTER.json');
  if (!fs.existsSync(routerPath)) return [];
  try {
    const router = JSON.parse(readText(routerPath));
    return [
      router.corpus?.base,
      router.corpus?.additional,
      ...(router.corpus?.expanded ?? []),
      ...(router.groups ?? []).map((g) => g.file),
    ].filter(Boolean).map((file) => path.resolve(ROOT, file)).filter(fs.existsSync);
  } catch {
    return [];
  }
}


function loadPrimaryAdviceIndex() {
  if (!fs.existsSync(PRIMARY_ADVICE_INDEX)) return { indexId: 'ACTION-INDEX-4000', recordCount: 0, records: [] };
  try {
    const value = JSON.parse(readText(PRIMARY_ADVICE_INDEX));
    return {
      indexId: String(value.indexId ?? 'ACTION-INDEX-4000'),
      capacity: Number(value.catalogCapacity ?? value.capacity ?? CATALOG_CAPACITY),
      recordCount: Number(value.recordCount ?? value.records?.length ?? 0),
      records: Array.isArray(value.records) ? value.records : [],
    };
  } catch {
    return { indexId: 'ACTION-INDEX-4000', capacity: 0, recordCount: 0, records: [] };
  }
}


const KNOWLEDGE_STOP_WORDS = new Set(['the','and','for','with','from','that','this','must','should','before','after','into','then','only','case','failure','error','repair','current','exact','sha','the','are','was','has','have','not']);
const knowledgeTokens = (value) => [...new Set(String(value ?? '').toLowerCase().match(/[a-z][a-z0-9_-]{3,}/gu) ?? [])].filter(token => !KNOWLEDGE_STOP_WORDS.has(token));
const diagnosisText = (diagnosis = {}) => [
  diagnosis.rootCause, diagnosis.errorClass, diagnosis.errorType, diagnosis.stage,
  diagnosis.mechanism, diagnosis.invariant, diagnosis.explanation, diagnosis.reason,
  diagnosis.decision, diagnosis.location?.file, diagnosis.location?.symbol,
  diagnosis.selectedFile, diagnosis.failureClass
].filter(Boolean).join(' ');

export function reviewDiagnosisAgainstKnowledge({ taskId, fingerprint, targetSha, failedRunId, diagnosis = {}, catalogReview = null } = {}) {
  if (!taskId || !fingerprint || !validSha(targetSha) || !failedRunId) throw new Error('ACTION_VAULT_DIAGNOSIS_REVIEW_IDENTITY_REQUIRED');
  if (!catalogReview || catalogReview.status !== 'REVIEWED' || catalogReview.reviewer !== 'ACTION-HISTORIAN-3' || catalogReview.targetSha !== targetSha) {
    throw new Error('ACTION_VAULT_DIAGNOSIS_REVIEW_CATALOG_REQUIRED');
  }
  const dTokens = knowledgeTokens(diagnosisText(diagnosis));
  const candidates = (catalogReview.matched ?? []).map((item) => {
    const text = [item.class,item.stage,item.trigger,item.invariant,item.action,item.teaching,item.verify].join(' ');
    const tokens = knowledgeTokens(text);
    const overlap = dTokens.filter(token => tokens.includes(token)).length;
    const classValue = String(item.class ?? '').toLowerCase();
    const diagnosisClass = String(diagnosis.errorClass ?? diagnosis.errorType ?? '').toLowerCase();
    const classMatch = Boolean(classValue && (
      diagnosisClass === classValue ||
      diagnosisClass.includes(classValue) ||
      classValue.includes(diagnosisClass)
    ));
    const stageMatch = Boolean(item.stage && String(diagnosis.stage ?? '').toLowerCase() === String(item.stage).toLowerCase());
    const overlapRatio = overlap / Math.max(1, dTokens.length);
    const jaccard = overlap / Math.max(1, new Set([...dTokens,...tokens]).size);
    const contradiction = /(never|must not|do not|block|forbidden|reject|unsafe)/iu.test(text) &&
      /(allow|enable|bypass|skip|ignore|force)/iu.test(diagnosisText(diagnosis));
    return {id:item.id ?? null,class:item.class ?? null,stage:item.stage ?? null,overlap,overlapRatio:Number(overlapRatio.toFixed(4)),jaccard:Number(jaccard.toFixed(4)),classMatch,stageMatch,contradiction};
  }).sort((a,b) => (Number(b.classMatch)-Number(a.classMatch)) || (Number(b.stageMatch)-Number(a.stageMatch)) || (b.overlapRatio-a.overlapRatio) || (b.jaccard-a.jaccard));
  const best = candidates[0] ?? null;
  const confidence = best ? Math.min(1,(best.classMatch?0.60:0)+(best.stageMatch?0.12:0)+(best.overlapRatio*0.23)+(best.jaccard*0.05)) : 0;
  let decision='INCONCLUSIVE';
  if (best?.contradiction) decision='MISMATCH';
  else if (best && confidence >= 0.60 && (best.classMatch || best.overlapRatio >= 0.30)) decision='MATCH';
  else if (!best || confidence < 0.20) decision='MISMATCH';
  return {
    schemaVersion:1,
    protocol:'ACTION-VAULT-DIAGNOSIS-KNOWLEDGE-REVIEW-v1',
    reviewer:'ACTION-HISTORIAN-3',
    reviewerRole:'MASTER_KNOWLEDGE_AND_DIAGNOSIS_REVIEW',
    taskId,fingerprint,targetSha,failedRunId:String(failedRunId),
    decision,allowSourceMutation:decision==='MATCH',
    mismatchBlocksMutation:true,inconclusiveBlocksMutation:true,
    diagnosisDigest:sha(JSON.stringify(diagnosis)),
    catalogDigest:catalogReview.digest,
    candidates:candidates.slice(0,12),
    bestMatch:best,
    confidence:Number(confidence.toFixed(4)),
    basis:'PROGRAMMING_DIAGNOSIS_VS_TEXTUAL_KNOWLEDGE_CLASS_STAGE_INVARIANT_ACTION_TEACHING',
    reviewedAt:new Date().toISOString()
  };
}

export function reviewCatalogBeforeMutation({ taskId, fingerprint, targetSha, failedRunId, errorText = '' } = {}) {
  if (!taskId || !fingerprint || !validSha(targetSha) || !failedRunId) throw new Error('ACTION_VAULT_CATALOG_REVIEW_IDENTITY_REQUIRED');
  const primary = loadPrimaryAdviceIndex();
  const adviceText = String(errorText).toLowerCase();
  const indexedMatches = primary.records
    .filter((item) => {
      const haystack = [item.id, item.class, item.stage, item.trigger, item.invariant, item.action, item.teaching, item.verify].join(' ').toLowerCase();
      const terms = [...new Set(adviceText.match(/[a-z][a-z0-9_-]{3,}/gu) ?? [])].slice(0, 32);
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, 20)
    .map((item) => ({ id: item.id ?? null, class: item.class ?? null, stage: item.stage ?? null, action: item.action ?? null, teaching: item.teaching ?? null, verify: item.verify ?? null }));
  const routerFiles = corpusFiles();
  const digest = sha(JSON.stringify({
    taskId, fingerprint, targetSha, failedRunId,
    indexId: primary.indexId,
    recordCount: primary.recordCount,
    matchedIds: indexedMatches.map((item) => item.id),
    routerFiles: routerFiles.map((file) => path.relative(ROOT, file)),
  }));
  return {
    schemaVersion: 1,
    protocol: 'ACTION-Vault-CATALOG-REVIEW-v1',
    status: 'REVIEWED',
    reviewer: 'ACTION-HISTORIAN-3',
    reviewerRole: 'COGNITIVE_CATALOG_SUPERVISOR_SEAT',
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId),
    source: {
      indexId: primary.indexId,
      indexPath: 'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',
      declaredCapacity: CATALOG_CAPACITY,
      actualRecordCount: primary.recordCount,
      routerPath: 'docs/agents/ERROR-TEACHING-ROUTER.json',
      routerSourceCount: routerFiles.length,
    },
    matched: indexedMatches,
    miss: indexedMatches.length === 0,
    searched: true,
    beforeMutation: true,
    mutationAuthority: false,
    digest,
    reviewedAt: new Date().toISOString(),
  };
}

function findCatalogAdvice(query = '') {
  const normalized = String(query).toLowerCase().replace(/[^a-z0-9_-]+/gu, ' ').trim();
  const terms = normalized.split(/\s+/u).filter((x) => x.length >= 4).slice(0, 12);
  const matches = [];
  for (const file of corpusFiles()) {
    for (const line of readText(file).split(/\r?\n/u)) {
      if (!/^T\d{3,4} \|/u.test(line)) continue;
      const lower = line.toLowerCase();
      const score = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
      if (score > 0) {
        matches.push({ ruleId: line.match(/^(T\d{3,4})/u)?.[1] ?? null, score, source: path.relative(ROOT, file), advice: line.slice(0, 1800) });
      }
    }
  }
  return matches.sort((a,b) => b.score - a.score || String(a.ruleId).localeCompare(String(b.ruleId))).slice(0, 20);
}

export function countUnresolvedOccurrences(fingerprint, ledger = loadLedger()) {
  const runs = new Set();
  for (const x of ledger) {
    if (x.failureFingerprint !== fingerprint) continue;
    if (!['RED_DETECTED','REPAIR_FAILED'].includes(x.eventType)) continue;
    if (x.result === 'VERIFIED') continue;
    if (x.failedRunId) runs.add(String(x.failedRunId));
  }
  return runs.size;
}

export function escalationFor(fingerprint, ledger = loadLedger()) {
  const occurrences = countUnresolvedOccurrences(fingerprint, ledger);
  return {
    occurrences,
    threshold: RECURRENCE_ESCALATION_THRESHOLD,
    mode: occurrences >= RECURRENCE_ESCALATION_THRESHOLD ? 'SUPERVISOR_20' : 'NORMAL_TRIAD',
    suspendedBots: occurrences >= RECURRENCE_ESCALATION_THRESHOLD ? ['ACTION-REPAIR','ACTION-REPAIR-2'] : [],
    supervisor: occurrences >= RECURRENCE_ESCALATION_THRESHOLD ? 'ACTION-HISTORIAN-3' : null,
  };
}

export function openErrorGate({ taskId, fingerprint, targetSha, failedRunId, errorText = '' }) {
  if (!taskId || !fingerprint || !validSha(targetSha) || !failedRunId) throw new Error('ACTION_VAULT_TRIAD_IDENTITY_REQUIRED');
  const catalogReview = reviewCatalogBeforeMutation({ taskId, fingerprint, targetSha, failedRunId, errorText });
  const advice = catalogReview.matched.length ? catalogReview.matched : findCatalogAdvice(errorText + ' ' + fingerprint);
  const escalation = escalationFor(fingerprint);
  const record = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventId: 'AVG-' + sha([taskId, fingerprint, targetSha, failedRunId].join('|')).slice(0, 24),
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId),
    catalog: {
      capacity: CATALOG_CAPACITY,
      primaryIndexRecordCount: catalogReview.source.actualRecordCount,
      matched: advice,
      review: catalogReview,
      miss: advice.length === 0,
      sources: ['ACTION-INDEX-4000','historical-action-errors','ERROR-TEACHING-ROUTER','ERROR-MEMORY'],
    },
    escalation,
    requiredContributions: BOTS,
    state: escalation.mode,
    at: new Date().toISOString(),
  };
  append(escalation.mode === 'SUPERVISOR_20' ? MISS_LEDGER : path.join(VAULT, 'triad-gate.ndjson'), record);
  if (record.catalog.miss) append(MISS_LEDGER, { ...record, eventType: 'CATALOG_MISS', learningStatus: 'CANDIDATE_ONLY' });
  writeJson(STATE, record);
  return record;
}

export function registerCatalogMiss(input) {
  const gate = openErrorGate(input);
  return { ...gate, catalogMissRecorded: Boolean(gate.catalog.miss) };
}

export function recordTriadProposal({ taskId, fingerprint, targetSha, failedRunId, botId, proposal, adviceIds = [], counterexamples = [] }) {
  if (!BOTS.includes(botId)) throw new Error('ACTION_VAULT_TRIAD_BOT_INVALID');
  if (!validSha(targetSha)) throw new Error('ACTION_VAULT_TRIAD_SHA_REQUIRED');
  if (!proposal) throw new Error('ACTION_VAULT_TRIAD_PROPOSAL_REQUIRED');
  const record = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventType: 'PROPOSAL',
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId), botId,
    proposal: String(proposal).slice(0, 16000),
    adviceIds: Array.isArray(adviceIds) ? adviceIds.slice(0, 32) : [],
    counterexamples: Array.isArray(counterexamples) ? counterexamples.slice(0, 32) : [],
    at: new Date().toISOString(),
  };
  append(path.join(VAULT, 'triad-proposals.ndjson'), record);
  return record;
}

export function selectByVault3({ taskId, fingerprint, targetSha, proposal1, proposal2, advice = [] }) {
  if (!validSha(targetSha)) throw new Error('ACTION_VAULT_TRIAD_SHA_REQUIRED');
  if (!proposal1 || !proposal2) throw new Error('ACTION_VAULT_TRIAD_TWO_PROPOSALS_REQUIRED');
  const text1 = String(proposal1).toLowerCase();
  const text2 = String(proposal2).toLowerCase();
  const adviceText = advice.map((x) => String(x?.advice ?? x)).join(' ').toLowerCase();
  const score = (proposal) => {
    const text = String(proposal).toLowerCase();
    const terms = [...new Set(adviceText.match(/[a-z0-9_-]{4,}/gu) ?? [])];
    const matched = terms.filter((term) => text.includes(term)).length;
    const counterexamplePenalty = /(counterexample|unsafe|regression|rejected)/u.test(text) ? 3 : 0;
    const causalMarkers = /(root cause|causal|invariant|targeted regression|exact sha)/u.test(text) ? 3 : 0;
    return matched + causalMarkers - counterexamplePenalty;
  };
  const s1 = score(text1), s2 = score(text2);
  const selectedBot = s1 >= s2 ? 'ACTION-REPAIR' : 'ACTION-REPAIR-2';
  const decision = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventType: 'VAULT3_SELECTION',
    supervisor: 'ACTION-HISTORIAN-3',
    taskId, fingerprint, targetSha,
    candidates: {
      'ACTION-REPAIR': { score: s1, proposal: String(proposal1).slice(0, 16000) },
      'ACTION-REPAIR-2': { score: s2, proposal: String(proposal2).slice(0, 16000) },
    },
    catalogAdviceReviewed: advice.slice(0, 20),
    selectedBot,
    selectionBasis: 'CATALOG_MATCH + CAUSAL_FIT + REGRESSION_SIGNAL - COUNTEREXAMPLE_SIGNAL',
    canonicalProofStillRequired: true,
    at: new Date().toISOString(),
  };
  append(path.join(VAULT, 'triad-selection.ndjson'), decision);
  writeJson(STATE, decision);
  return decision;
}

export function recordLearnedAdvice({ taskId, fingerprint, targetSha, failedRunId, advice, sourceBots = BOTS, verified = false }) {
  if (!advice) throw new Error('ACTION_VAULT_TRIAD_ADVICE_REQUIRED');
  const record = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventType: 'LEARNED_ADVICE',
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId),
    sourceBots: sourceBots.filter((id) => BOTS.includes(id)),
    advice: String(advice).slice(0, 8000),
    verified: Boolean(verified),
    promotion: verified ? 'ELIGIBLE_AFTER_CANONICAL_GREEN' : 'CANDIDATE_ONLY',
    at: new Date().toISOString(),
  };
  append(LEARNED, record);
  return record;
}

export function promoteLearnedAdvice({ taskId, fingerprint, targetSha, failedRunId, advice, greenRecord }) {
  if (!greenRecord || greenRecord.source !== 'DAILY_FLIXO_GREEN_GATE' || greenRecord.conclusion !== 'success' || greenRecord.zeroRed !== true || greenRecord.exactShaVerified !== true || greenRecord.targetSha !== targetSha) {
    throw new Error('ACTION_VAULT_TRIAD_GREEN_PROOF_REQUIRED_FOR_ADVICE_PROMOTION');
  }
  if (!advice) throw new Error('ACTION_VAULT_TRIAD_ADVICE_REQUIRED');
  const record = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventType: 'ADVICE_PROMOTED',
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId),
    advice: String(advice).slice(0, 8000),
    sourceBots: BOTS,
    provenance: { greenRecordId: greenRecord.recordId ?? null, source: greenRecord.source },
    at: new Date().toISOString(),
  };
  append(ADVICE_CATALOG, record);
  return record;
}

function cli() {
  const op = process.argv[2];
  const args = Object.fromEntries(process.argv.slice(3).map((x) => {
    const [k, ...v] = x.replace(/^--/u, '').split('=');
    return [k, v.join('=')];
  }));
  if (op === 'gate') {
    const result = openErrorGate({ taskId: args.task, fingerprint: args.fingerprint, targetSha: args.sha, failedRunId: args.run, errorText: args.error ?? '' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (op === 'promote') {
    const green = args['green-record-json'] ? JSON.parse(args['green-record-json']) : null;
    const result = promoteLearnedAdvice({ taskId: args.task, fingerprint: args.fingerprint, targetSha: args.sha, failedRunId: args.run, advice: args.advice, greenRecord: green });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (op === 'miss') {
    const result = registerCatalogMiss({ taskId: args.task, fingerprint: args.fingerprint, targetSha: args.sha, failedRunId: args.run, errorText: args.error ?? '' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error('ACTION_VAULT_TRIAD_OPERATION_INVALID');
}
if (import.meta.url === `file://${process.argv[1]}`) cli();