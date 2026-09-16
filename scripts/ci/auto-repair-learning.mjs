import fs from 'node:fs';
import { normalizeFailure, fingerprintFailure } from './auto-repair/fingerprint.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
export { normalizeFailure, fingerprintFailure };

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 4, cases: [], playbooks: [] };
  try { return { version: 4, cases: [], playbooks: [], ...JSON.parse(fs.readFileSync(memoryPath, 'utf8')) }; }
  catch { return { version: 4, cases: [], playbooks: [] }; }
}
export function findCase(memory, fingerprint) { return memory.cases.find((item) => item.fingerprint === fingerprint); }
export function scorePlaybook(memory, rootCause, rule) {
  const records = memory.playbooks.filter((item) => item.rootCause === rootCause && item.rule === rule);
  const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
  const successes = records.reduce((sum, item) => sum + item.successes, 0);
  return attempts ? successes / attempts : 0;
}
export function recordOutcome(memory, { fingerprint, rootCause, rule, outcome, verification }) {
  const entry = findCase(memory, fingerprint) ?? { fingerprint, rootCause, attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [] };
  entry.rootCause = rootCause ?? entry.rootCause ?? 'unknown';
  if (outcome !== 'proposed') entry.attempts += 1;
  if (outcome === 'success') entry.successes += 1; else if (outcome !== 'proposed') entry.failures += 1;
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  if (rule && outcome !== 'proposed') {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule) ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0 };
    playbook.attempts += 1;
    if (outcome === 'success') playbook.successes += 1; else playbook.failures += 1;
    playbook.successRate = playbook.successes / playbook.attempts;
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  return memory;
}
export function writeMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}
if (process.argv[1]?.endsWith('auto-repair-learning.mjs') && process.env.FLIXO_LEARNING_OUTCOME) {
  const memory = loadMemory();
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  recordOutcome(memory, { fingerprint: fingerprintFailure(log), rootCause: process.env.FLIXO_ROOT_CAUSE ?? 'unknown', rule: process.env.FLIXO_REPAIR_RULE || undefined, outcome: process.env.FLIXO_LEARNING_OUTCOME, verification: process.env.FLIXO_VERIFICATION ?? 'unknown' });
  writeMemory(memory);
}
