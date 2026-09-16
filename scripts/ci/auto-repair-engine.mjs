import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const targetDir = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const evidencePath = '/tmp/flixo-repair-evidence.json';
const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? `${targetDir}/diagnostics/auto-repair/memory.json`;

const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const memory = fs.existsSync(memoryPath) ? JSON.parse(fs.readFileSync(memoryPath, 'utf8')) : { version: 3, cases: [] };
const known = memory.cases.find((entry) => entry.fingerprint === fingerprint);
if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}

if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const plan = planRepair(log);
const selected = plan.selected;
const evidence = { fingerprint, targetSha: git(['rev-parse', 'HEAD']).trim(), features: plan.features, candidates: plan.candidates, selected: selected?.id ?? null, outcome: 'diagnostic-only', changedPaths: [], updatedAt: new Date().toISOString() };

if (selected?.mutate && selected.confidence >= 90) {
  console.log(`AUTO_REPAIR_PLAN=${selected.id}`);
  for (const [command, args] of selected.commands) execFileSync(command, args, { cwd: targetDir, stdio: 'inherit' });
  evidence.outcome = 'repair-applied';
} else console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected?.id ?? 'none'}`);

const changed = git(['status', '--short']).trim();
const changedPaths = changed.split('\n').filter(Boolean).map((line) => line.slice(3).trim());
const blocked = changedPaths.filter((path) => !isPathAllowed(path));
if (blocked.length) {
  evidence.outcome = 'blocked'; evidence.blockedPaths = blocked;
  git(['restore', '--staged', '--worktree', '--', ...blocked], { stdio: 'inherit' });
}

evidence.changedPaths = changedPaths;
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
const entry = known ?? { fingerprint, attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [] };
entry.attempts += 1;
entry.rules = [...new Set([...entry.rules, ...(selected ? [selected.id] : [])])];
entry.outcomes.push({ outcome: evidence.outcome, rule: selected?.id ?? null, at: new Date().toISOString() });
entry.outcomes = entry.outcomes.slice(-10);
if (!known) memory.cases.push(entry);
fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);

if (blocked.length) process.exitCode = 2;
console.log(`AUTO_REPAIR_FINGERPRINT=${fingerprint}`);
console.log(`AUTO_REPAIR_CHANGED=${changedPaths.join(',') || 'none'}`);
