import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import {
  fingerprintFailure,
  findCase,
  loadMemory,
  recordOutcome,
  scorePlaybook,
  writeMemory,
} from './auto-repair-learning.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const memory = loadMemory();
const fingerprint = fingerprintFailure(log);
const evidencePath = '/tmp/flixo-repair-evidence.json';

let classification = { rootCause: 'unknown', matches: [] };
if (fs.existsSync('/tmp/flixo-root-cause.json')) {
  try { classification = JSON.parse(fs.readFileSync('/tmp/flixo-root-cause.json', 'utf8')); } catch {}
}

const known = findCase(memory, fingerprint);
if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}

const clean = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (repairPolicy.requireCleanGitBeforeRepair && clean) {
  throw new Error(`AUTO_REPAIR_DIRTY_WORKTREE=${clean}`);
}

const rules = [
  { id: 'eslint-unused', rootCause: 'lint', pattern: /no-unused-vars|unused .* is defined|defined but never used|@typescript-eslint\/no-unused-vars/i, command: ['npx', ['eslint', '.', '--fix']] },
  { id: 'prettier', rootCause: 'format', pattern: /prettier|formatting|code style/i, command: ['npx', ['prettier', '--write', '.']] },
];

const matched = rules.filter((rule) => rule.pattern.test(log));
const compatible = matched.filter((rule) => rule.rootCause === classification.rootCause || classification.rootCause === 'unknown');
const ranked = [...compatible].sort((a, b) => scorePlaybook(memory, classification.rootCause, b.id) - scorePlaybook(memory, classification.rootCause, a.id));
const selected = repairPolicy.requireDeterministicMatch ? ranked[0] : ranked[0];

const evidence = {
  fingerprint,
  rootCause: classification.rootCause,
  matches: classification.matches,
  candidateRules: ranked.map((rule) => ({ id: rule.id, historicalSuccessRate: scorePlaybook(memory, classification.rootCause, rule.id) })),
  selectedRule: selected?.id ?? null,
  protectedPaths: repairPolicy.protectedAreas,
  outcome: 'diagnostic-only',
};

if (!selected) {
  console.log('AUTO_REPAIR_RESULT=NO_SAFE_RULE');
} else {
  console.log(`AUTO_REPAIR_RULE=${selected.id}`);
  execFileSync(selected.command[0], selected.command[1], { stdio: 'inherit' });
  evidence.outcome = 'repair-applied';
}

const changed = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const changedPaths = changed.split('\n').filter(Boolean).map((line) => line.slice(3).trim());
const blocked = changedPaths.filter((path) => !isPathAllowed(path));
if (blocked.length) {
  evidence.outcome = 'blocked';
  evidence.blockedPaths = blocked;
  execFileSync('git', ['restore', '--staged', '--worktree', '--', ...blocked], { stdio: 'inherit' });
}

const diffStat = execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' });
const additions = Number((diffStat.match(/(\d+) insertion/) ?? [])[1] ?? 0);
const deletions = Number((diffStat.match(/(\d+) deletion/) ?? [])[1] ?? 0);
if (changedPaths.length > repairPolicy.maxChangedFiles || additions + deletions > repairPolicy.maxChangedLines) {
  evidence.outcome = 'bounded-change-block';
  evidence.changedFiles = changedPaths.length;
  evidence.changedLines = additions + deletions;
  if (changedPaths.length) execFileSync('git', ['restore', '--staged', '--worktree', '--', ...changedPaths], { stdio: 'inherit' });
}

evidence.changedPaths = changedPaths;
evidence.updatedAt = new Date().toISOString();
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

recordOutcome(memory, {
  fingerprint,
  rootCause: classification.rootCause,
  rule: selected?.id,
  outcome: evidence.outcome === 'repair-applied' ? 'proposed' : evidence.outcome,
  verification: 'pending',
});
writeMemory(memory);

if (blocked.length) process.exitCode = 2;
console.log(`AUTO_REPAIR_FINGERPRINT=${fingerprint}`);
console.log(`AUTO_REPAIR_ROOT_CAUSE=${classification.rootCause}`);
console.log(`AUTO_REPAIR_SELECTED=${selected?.id ?? 'none'}`);
console.log(`AUTO_REPAIR_CHANGED=${changedPaths.join(',') || 'none'}`);
