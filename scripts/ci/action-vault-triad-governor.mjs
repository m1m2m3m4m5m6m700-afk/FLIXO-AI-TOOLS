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
  const advice = findCatalogAdvice(errorText + ' ' + fingerprint);
  const escalation = escalationFor(fingerprint);
  const record = {
    schemaVersion: 1,
    protocol: ACTION_VAULT_TRIAD_PROTOCOL,
    eventId: 'AVG-' + sha([taskId, fingerprint, targetSha, failedRunId].join('|')).slice(0, 24),
    taskId, fingerprint, targetSha, failedRunId: String(failedRunId),
    catalog: {
      capacity: CATALOG_CAPACITY,
      matched: advice,
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
