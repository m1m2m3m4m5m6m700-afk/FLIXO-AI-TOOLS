import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';

function fingerprint(input) {
  return input
    .replace(/\b\d{8,}\b/g, '<RUN>')
    .replace(/[0-9a-f]{40}/gi, '<SHA>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 1, cases: [] };
  try { return JSON.parse(fs.readFileSync(memoryPath, 'utf8')); }
  catch { return { version: 1, cases: [] }; }
}

function saveMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}

const memory = loadMemory();
const failureFingerprint = fingerprint(log);
const known = memory.cases.find((entry) => entry.fingerprint === failureFingerprint);
const attempts = known?.attempts ?? 0;

if (attempts >= repairPolicy.maxAttemptsPerRun) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  console.log(`AUTO_REPAIR_FINGERPRINT=${failureFingerprint}`);
  process.exit(0);
}

const rules = [
  { id: 'eslint-unused', pattern: /no-unused-vars|unused .* is defined|defined but never used|@typescript-eslint\/no-unused-vars/i, command: ['npx', ['eslint', '.', '--fix']] },
  { id: 'prettier', pattern: /prettier|formatting|code style/i, command: ['npx', ['prettier', '--write', '.']] },
];

const matched = rules.filter((rule) => rule.pattern.test(log));
const mutating = matched.filter((rule) => rule.id === 'eslint-unused' || rule.id === 'prettier');

if (mutating.length === 0) {
  console.log('AUTO_REPAIR_RESULT=NO_SAFE_RULE');
} else {
  for (const rule of mutating) {
    console.log(`AUTO_REPAIR_RULE=${rule.id}`);
    execFileSync(rule.command[0], rule.command[1], { stdio: 'inherit' });
  }
}

const changed = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const changedPaths = changed.split('\n').filter(Boolean).map((line) => line.slice(3));
const blocked = changedPaths.filter((path) => !isPathAllowed(path));
if (blocked.length) {
  console.error(`AUTO_REPAIR_BLOCKED_PATHS=${blocked.join(',')}`);
  execFileSync('git', ['restore', '--staged', '--worktree', '--', ...blocked], { stdio: 'inherit' });
  process.exitCode = 2;
}

const caseRecord = known ?? { fingerprint: failureFingerprint, attempts: 0, successes: 0, failures: 0, rules: [] };
caseRecord.attempts += 1;
caseRecord.rules = [...new Set([...caseRecord.rules, ...matched.map((rule) => rule.id)])];
caseRecord.lastOutcome = process.exitCode ? 'blocked' : (mutating.length ? 'repair-applied' : 'diagnostic-only');
caseRecord.updatedAt = new Date().toISOString();
if (!known) memory.cases.push(caseRecord);
saveMemory(memory);

console.log(`AUTO_REPAIR_FINGERPRINT=${failureFingerprint}`);
console.log(`AUTO_REPAIR_MEMORY_ATTEMPTS=${caseRecord.attempts}`);
console.log(`AUTO_REPAIR_MATCHES=${matched.map((r) => r.id).join(',') || 'none'}`);
console.log(`AUTO_REPAIR_MUTATED=${mutating.map((r) => r.id).join(',') || 'none'}`);
