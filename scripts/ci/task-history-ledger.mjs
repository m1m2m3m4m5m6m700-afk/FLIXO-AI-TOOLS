#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const LEDGER = path.resolve(ROOT, 'docs/agents/task-history/ledger.jsonl');
const STATE = path.resolve(ROOT, 'diagnostics/agents/coordination-state.json');
const EXECUTED = new Set(['RUNNING', 'DONE', 'STALE', 'BLOCKED', 'FAILED', 'VERIFIED', 'IMPLEMENTED']);

const fail = (message) => {
  console.error(`TASK_HISTORY_LEDGER_FAIL=${message}`);
  process.exitCode = 1;
  throw new Error(message);
};

const readLines = (file) => {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/u).filter((line) => line.length > 0);
};

const parseLedger = () => {
  const lines = readLines(LEDGER);
  const records = [];
  const keys = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    let record;
    try {
      record = JSON.parse(lines[index]);
    } catch (error) {
      fail(`MALFORMED_JSON_LINE=${index + 1}`);
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`INVALID_RECORD_LINE=${index + 1}`);
    if (!record.executionKey) fail(`MISSING_EXECUTION_KEY_LINE=${index + 1}`);
    const previous = keys.get(record.executionKey);
    if (previous) {
      const current = JSON.stringify(record);
      if (previous.raw !== current) fail(`CONFLICTING_DUPLICATE_EXECUTION_KEY=${record.executionKey}`);
      fail(`DUPLICATE_EXECUTION_KEY=${record.executionKey}`);
    }
    keys.set(record.executionKey, { raw: JSON.stringify(record), line: index + 1 });
    records.push(record);
  }
  return { lines, records, keys };
};

const loadState = () => {
  if (!fs.existsSync(STATE)) return { tasks: {} };
  const parsed = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  return parsed && typeof parsed === 'object' ? parsed : { tasks: {} };
};

const executionKeyFor = (task) => {
  const taskId = String(task.taskId ?? '').trim();
  const sessionId = String(task.sessionId ?? task.claimedBy ?? 'unknown-session').trim();
  const entrySha = String(task.entrySha ?? task.exitSha ?? 'unknown-sha').trim();
  return `${taskId}:${sessionId}:${entrySha}`;
};

const recordFor = (task) => ({
  schemaVersion: 1,
  executionKey: executionKeyFor(task),
  taskId: task.taskId,
  sessionId: task.sessionId ?? null,
  agentId: task.claimedBy ?? task.ownerAgent ?? null,
  role: task.ownerRole ?? null,
  chairId: task.chairId ?? null,
  status: task.status,
  entrySha: task.entrySha ?? null,
  exitSha: task.exitSha ?? null,
  startedAt: task.claimedAt ?? task.createdAt ?? null,
  completedAt: task.completedAt ?? null,
  updatedAt: task.completedAt ?? task.claimedAt ?? task.createdAt ?? null,
  evidence: Array.isArray(task.evidence) ? task.evidence : [],
  findings: Array.isArray(task.findings) ? task.findings : [],
  finalStatus: task.finalStatus ?? null,
  finalSummary: task.finalSummary ?? null,
  sourceOfTruth: task.sourceOfTruth ?? 'agent-coordination',
  sourceTaskLedger: 'المهام.md',
});

const reconcile = () => {
  const { lines, keys } = parseLedger();
  const state = loadState();
  const tasks = Object.values(state.tasks ?? {});
  const missing = tasks
    .filter((task) => EXECUTED.has(String(task.status ?? '').toUpperCase()))
    .filter((task) => task.taskId && (task.claimedAt || task.entrySha || task.exitSha))
    .map(recordFor)
    .filter((record) => !keys.has(record.executionKey));

  if (!missing.length) {
    console.log(`TASK_HISTORY_LEDGER=PASS records=${lines.length} appended=0`);
    return;
  }

  const suffix = missing.map((record) => JSON.stringify(record)).join('\n') + '\n';
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.appendFileSync(LEDGER, suffix, { encoding: 'utf8', flag: 'a' });
  console.log(`TASK_HISTORY_LEDGER=PASS records=${lines.length + missing.length} appended=${missing.length}`);
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const verifyImmutableAgainst = (base) => {
  if (!fs.existsSync(LEDGER)) fail('LEDGER_MISSING');
  const baseContent = (() => {
    try {
      return git(['show', `${base}:docs/agents/task-history/ledger.jsonl`]);
    } catch {
      return '';
    }
  })();
  const current = fs.readFileSync(LEDGER, 'utf8');
  if (!baseContent) {
    parseLedger();
    console.log('TASK_HISTORY_IMMUTABILITY=PASS baseline=none');
    return;
  }
  if (!current.startsWith(baseContent)) fail('HISTORICAL_PREFIX_MODIFIED_OR_DELETED');
  parseLedger();
  console.log(`TASK_HISTORY_IMMUTABILITY=PASS preservedBytes=${Buffer.byteLength(baseContent, 'utf8')}`);
};

const command = process.argv[2] ?? 'reconcile';
if (command === 'reconcile') reconcile();
else if (command === 'verify') {
  const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice('--base='.length) ?? 'HEAD^';
  verifyImmutableAgainst(base);
} else if (command === 'check') {
  parseLedger();
  console.log('TASK_HISTORY_LEDGER_CHECK=PASS');
} else fail(`UNKNOWN_COMMAND=${command}`);
