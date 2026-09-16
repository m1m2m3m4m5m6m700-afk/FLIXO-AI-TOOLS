import fs from 'node:fs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';

export function normalizeFailure(text) {
  return text
    .replace(/\b\d{8,}\b/g, '<RUN>')
    .replace(/[0-9a-f]{40}/gi, '<SHA>')
    .replace(/\b(?:chromium|firefox|webkit)\b/gi, '<BROWSER>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
}

export function fingerprintFailure(text) { return normalizeFailure(text); }

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 3, cases: [], playbooks: [] };
  try {
    const value = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    return { version: 3, cases: [], playbooks: [], ...value };
  } catch {
    return { version: 3, cases: [], playbooks: [] };
  }
}

export function findCase(memory, fingerprint) {
  return memory.cases.find((item) => item.fingerprint === fingerprint);
}

export function scorePlaybook(memory, rootCause, rule) {
  const records = memory.playbooks.filter((item) => item.rootCause === rootCause && item.rule === rule);
  const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
  const successes = records.reduce((sum, item) => sum + item.successes, 0);
  return attempts ? successes / attempts : 0;
}

export function recordOutcome(memory, { fingerprint, rootCause, rule, outcome, verification }) {
  const entry = findCase(memory, fingerprint) ?? {
    fingerprint, rootCause, attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [],
  };
  entry.rootCause = rootCause ?? entry.rootCause ?? 'unknown';
  entry.attempts += 1;
  if (outcome === 'success') entry.successes += 1;
  else if (outcome !== 'proposed') entry.failures += 1;
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);

  if (rule) {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule)
      ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0 };
    if (outcome !== 'proposed') {
      playbook.attempts += 1;
      if (outcome === 'success') playbook.successes += 1;
      else playbook.failures += 1;
      playbook.successRate = playbook.successes / playbook.attempts;
    }
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  return memory;
}

export function writeMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('auto-repair-learning.mjs') && process.env.FLIXO_LEARNING_OUTCOME) {
  const memory = loadMemory();
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const fingerprint = fingerprintFailure(log);
  const rootCause = process.env.FLIXO_ROOT_CAUSE ?? 'unknown';
  const rule = process.env.FLIXO_REPAIR_RULE || undefined;
  recordOutcome(memory, {
    fingerprint,
    rootCause,
    rule,
    outcome: process.env.FLIXO_LEARNING_OUTCOME,
    verification: process.env.FLIXO_VERIFICATION ?? 'unknown',
  });
  writeMemory(memory);
}
