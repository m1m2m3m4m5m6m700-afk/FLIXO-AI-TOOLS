#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const AUTO_REPAIR_TASK_LEDGER_VERSION = 1;
const SHA_RE = /^[a-f0-9]{40}$/iu;
const MAX_EVENTS = 256;
const env = (name, fallback = null) => process.env[name] ?? fallback;
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const requireSha = (value, label) => { const v = String(value ?? ''); if (!SHA_RE.test(v)) throw new Error('AUTO_REPAIR_TASK_LEDGER_' + label + '_INVALID'); return v; };

export function deriveTaskId({ taskId, targetRunId, fingerprint } = {}) {
  if (taskId) return String(taskId);
  if (targetRunId && fingerprint) return 'AUTO-REPAIR:' + String(targetRunId) + ':' + String(fingerprint);
  if (targetRunId) return 'AUTO-REPAIR:' + String(targetRunId);
  throw new Error('AUTO_REPAIR_TASK_LEDGER_TASK_ID_REQUIRED');
}

export function appendTaskEvent(ledger, { type, detail = {}, at = new Date().toISOString() } = {}) {
  const eventType = String(type ?? '').trim();
  if (!eventType) throw new Error('AUTO_REPAIR_TASK_LEDGER_EVENT_TYPE_REQUIRED');
  ledger.events = [...(ledger.events ?? []), { sequence: (ledger.events?.length ?? 0) + 1, type: eventType, at, detail }].slice(-MAX_EVENTS);
  ledger.updatedAt = at;
  return ledger;
}

export function writeTaskLedger(path, ledger) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const unsigned = { ...ledger };
  delete unsigned.integritySha256;
  unsigned.events = (unsigned.events ?? []).slice(-MAX_EVENTS);
  const body = JSON.stringify(unsigned, null, 2) + '\n';
  const integritySha256 = createHash('sha256').update(body).digest('hex');
  fs.writeFileSync(path, JSON.stringify({ ...unsigned, integritySha256 }, null, 2) + '\n');
  return { ...unsigned, integritySha256 };
}

export function startTaskLedger({ path = env('FLIXO_REPAIR_TASK_LEDGER_PATH', '/tmp/flixo-repair-task-ledger.json'), taskId = env('FLIXO_TASK_ID'), repairChainId = env('FLIXO_REPAIR_CHAIN_ID'), failureRunId = env('TARGET_RUN_ID'), fingerprint = env('FLIXO_FAILURE_FINGERPRINT'), failedSha = env('FLIXO_FAILED_SHA') || null, targetSha = env('FLIXO_TARGET_SHA') || failedSha || null } = {}) {
  const ledger = { schemaVersion: AUTO_REPAIR_TASK_LEDGER_VERSION, protocol: 'FLIXO-AUTO-REPAIR-TASK-LEDGER-v1', taskId: deriveTaskId({ taskId, targetRunId: failureRunId, fingerprint }), repairChainId: repairChainId ? String(repairChainId) : null, failureRunId: failureRunId ? String(failureRunId) : null, failureFingerprint: fingerprint ? String(fingerprint) : null, failedSha: failedSha ? requireSha(failedSha, 'FAILED_SHA') : null, baselineSha: targetSha ? requireSha(targetSha, 'BASELINE_SHA') : null, candidateSha: null, branch: 'execution', status: 'ACTIVE', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [], changedPaths: [], verification: { targeted: null, adversarial: null, candidate: null, canonical: null, exactShaVerified: false }, rootCause: null, preventionRule: null, closure: { canonicalGreen: false, exactShaCertified: false, closed: false } };
  appendTaskEvent(ledger, { type: 'SESSION_STARTED', detail: { owner: 'AUTO_REPAIR_BOT', mode: 'BOUNDED_REPAIR' } });
  writeTaskLedger(path, ledger);
  return ledger;
}

export function loadTaskLedger(path = env('FLIXO_REPAIR_TASK_LEDGER_PATH', '/tmp/flixo-repair-task-ledger.json')) {
  const ledger = readJson(path);
  if (!ledger || ledger.protocol !== 'FLIXO-AUTO-REPAIR-TASK-LEDGER-v1') throw new Error('AUTO_REPAIR_TASK_LEDGER_MISSING_OR_INVALID');
  const unsigned = { ...ledger };
  const integritySha256 = unsigned.integritySha256;
  delete unsigned.integritySha256;
  unsigned.events = (unsigned.events ?? []).slice(-MAX_EVENTS);
  const expected = createHash('sha256').update(JSON.stringify(unsigned, null, 2) + '\n').digest('hex');
  if (integritySha256 !== expected) throw new Error('AUTO_REPAIR_TASK_LEDGER_INTEGRITY_INVALID');
  return ledger;
}

export function finalizeTaskLedger(ledger, { outcome = 'FAILED_REPAIR', candidateSha = null, rootCause = null, preventionRule = null, changedPaths = [], verification = {}, exactShaVerified = false, canonicalGreen = false, canonicalRunId = null } = {}) {
  ledger.outcome = String(outcome);
  ledger.candidateSha = candidateSha ? requireSha(candidateSha, 'CANDIDATE_SHA') : null;
  ledger.rootCause = rootCause ?? ledger.rootCause ?? null;
  ledger.preventionRule = preventionRule ?? ledger.preventionRule ?? null;
  ledger.changedPaths = [...new Set([...(ledger.changedPaths ?? []), ...(Array.isArray(changedPaths) ? changedPaths : [])].map(String).filter(Boolean))].slice(0, 64).sort();
  ledger.verification = { ...(ledger.verification ?? {}), ...(verification ?? {}), exactShaVerified: Boolean(exactShaVerified), canonical: canonicalRunId ? String(canonicalRunId) : (ledger.verification?.canonical ?? null) };
  ledger.closure = { canonicalGreen: Boolean(canonicalGreen), exactShaCertified: Boolean(exactShaVerified && canonicalGreen), closed: Boolean(exactShaVerified && canonicalGreen) };
  ledger.status = ledger.closure.closed ? 'CLOSED' : (ledger.outcome === 'VERIFIED_REPAIR' || ledger.outcome === 'VERIFIED_HISTORICAL_REVERT') ? 'VERIFIED_PENDING_CANONICAL_GREEN' : ledger.outcome === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : 'RECOVERING';
  appendTaskEvent(ledger, { type: 'SESSION_FINALIZED', detail: { outcome: ledger.outcome, status: ledger.status, exactShaVerified: Boolean(exactShaVerified), canonicalGreen: Boolean(canonicalGreen), closed: ledger.closure.closed } });
  return ledger;
}

function git(args) { return execFileSync('git', ['-C', process.cwd(), ...args], { encoding: 'utf8' }).trim(); }

if (process.argv[1]?.endsWith('auto-repair-task-ledger.mjs')) {
  const command = process.argv[2] ?? 'contract';
  const path = env('FLIXO_REPAIR_TASK_LEDGER_PATH', '/tmp/flixo-repair-task-ledger.json');
  if (command === 'start') { startTaskLedger({ path }); console.log('AUTO_REPAIR_TASK_LEDGER_START=PASS'); }
  else if (command === 'event') { const ledger = loadTaskLedger(path); const type = process.argv.find(v => v.startsWith('--type='))?.slice(7); appendTaskEvent(ledger, { type, detail: { runId: env('GITHUB_RUN_ID'), job: env('GITHUB_JOB'), sha: env('FLIXO_FAILED_SHA') || env('FLIXO_TARGET_SHA') } }); writeTaskLedger(path, ledger); console.log('AUTO_REPAIR_TASK_LEDGER_EVENT=PASS'); }
  else if (command === 'finish') {
    const ledger = loadTaskLedger(path);
    const evidence = readJson(env('FLIXO_REPAIR_EVIDENCE_PATH', '/tmp/flixo-repair-evidence.json')) ?? {};
    const diagnosis = readJson(env('FLIXO_REPAIR_DIAGNOSIS_PATH', '/tmp/flixo-root-cause.json')) ?? {};
    const engineOutcome = fs.existsSync('/tmp/flixo-engine-outcome') ? fs.readFileSync('/tmp/flixo-engine-outcome','utf8').trim() : 'engine-error';
    const candidate = fs.existsSync('/tmp/flixo-candidate-sha') ? fs.readFileSync('/tmp/flixo-candidate-sha','utf8').trim() : null;
    let changedPaths = Array.isArray(evidence.changedPaths) ? evidence.changedPaths : [];
    if (candidate && SHA_RE.test(candidate)) { try { const parent = git(['rev-parse', candidate + '^']); changedPaths = [...new Set(changedPaths.concat(git(['diff','--name-only',parent,candidate]).split(/\r?\n/).filter(Boolean)))]; } catch (error) { changedPaths = Array.isArray(changedPaths) ? changedPaths : []; } }
    const verified = env('TASK_LEDGER_VERIFIED','false') === 'true';
    const outcome = engineOutcome === 'verified-historical-revert' ? 'VERIFIED_HISTORICAL_REVERT' : engineOutcome === 'verified-repair' && verified ? 'VERIFIED_REPAIR' : engineOutcome === 'blocked-external' ? 'BLOCKED_EXTERNAL' : 'FAILED_REPAIR';
    const done = finalizeTaskLedger(ledger, { outcome, candidateSha: candidate && SHA_RE.test(candidate) ? candidate : null, rootCause: diagnosis.rootCause ?? evidence.rootCause ?? null, preventionRule: evidence.preventionRule ?? null, changedPaths, exactShaVerified: verified, canonicalGreen: env('TASK_LEDGER_CANONICAL_GREEN','false') === 'true', canonicalRunId: env('TASK_LEDGER_CANONICAL_RUN_ID'), verification: { targeted: env('TASK_LEDGER_TARGETED_VERIFICATION'), adversarial: env('TASK_LEDGER_ADVERSARIAL_VERIFICATION'), candidate: env('TASK_LEDGER_CANDIDATE_VERIFICATION') } });
    appendTaskEvent(done, { type: 'RCA_AND_OUTCOME_CAPTURED', detail: { engineOutcome, rootCause: done.rootCause, changedPathCount: done.changedPaths.length } });
    writeTaskLedger(path, done);
    console.log('AUTO_REPAIR_TASK_LEDGER_FINISH=PASS');
  }
  else if (command === 'contract') { const sample = startTaskLedger({ path: '/tmp/flixo-task-ledger-contract.json', taskId: 'contract-task', repairChainId: 'contract-chain', failureRunId: '1', fingerprint: 'abc', failedSha: 'a'.repeat(40), targetSha: 'a'.repeat(40) }); finalizeTaskLedger(sample,{outcome:'VERIFIED_REPAIR',candidateSha:'b'.repeat(40),exactShaVerified:true,canonicalGreen:false}); if(sample.status!=='VERIFIED_PENDING_CANONICAL_GREEN'||sample.closure.closed) throw new Error('AUTO_REPAIR_TASK_LEDGER_CONTRACT_FAILED'); console.log('AUTO_REPAIR_TASK_LEDGER_CONTRACT=PASS'); }
  else throw new Error('Usage: auto-repair-task-ledger.mjs start|event|finish|contract');
}
