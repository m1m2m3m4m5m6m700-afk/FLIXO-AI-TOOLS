import fs from 'node:fs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';

export function normalizeFailure(text) {
  return text
    .replace(/\b\d{8,}\b/g, '<RUN>')
    .replace(/[0-9a-f]{40}/gi, '<SHA>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
}

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 2, cases: [], playbooks: [] };
  try {
    const value = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    return { version: 2, cases: [], playbooks: [], ...value };
  } catch {
    return { version: 2, cases: [], playbooks: [] };
  }
}

export function recordOutcome(memory, { fingerprint, rule, outcome, verification }) {
  const entry = memory.cases.find((item) => item.fingerprint === fingerprint) ?? {
    fingerprint, attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [],
  };
  entry.attempts += 1;
  if (outcome === 'success') entry.successes += 1;
  else entry.failures += 1;
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  return memory;
}

export function writeMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}
