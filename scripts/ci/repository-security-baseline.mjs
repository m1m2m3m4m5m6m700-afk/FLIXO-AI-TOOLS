import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const failures = [];

// Write-capable workflows are restricted to the bounded repair control plane.
// execution-sync is the canonical execution-branch reconciliation controller; it
// may write only to execution and trigger canonical CI, and it merges only after
// exact-head GREEN evidence. Direct-main repair remains intentionally forbidden.
const writeWorkflowAllowlist = new Set([
  '.github/workflows/auto-repair.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
  '.github/workflows/execution-sync.yml',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function workflowFiles() {
  return walk(workflowDir).filter((file) => /\.ya?ml$/i.test(file));
}

for (const file of workflowFiles()) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');

  if (/^\s*pull_request_target\s*:/m.test(text)) {
    failures.push(`${relative}: pull_request_target is forbidden by the repository baseline`);
  }

  if (/^\s*permissions\s*:\s*write-all\s*$/m.test(text)) {
    failures.push(`${relative}: permissions: write-all is forbidden`);
  }

  const hasContentsWrite = /^\s*contents\s*:\s*write\s*$/m.test(text);
  if (hasContentsWrite && !writeWorkflowAllowlist.has(relative)) {
    failures.push(`${relative}: contents: write requires explicit security allowlisting`);
  }

  if (/^\s*permissions\s*:\s*$/m.test(text) === false) {
    failures.push(`${relative}: missing explicit workflow permissions block`);
  }
}

const packageLock = path.join(root, 'package-lock.json');
if (!fs.existsSync(packageLock)) failures.push('package-lock.json: missing lockfile');

const securityDoc = path.join(root, 'docs', 'security.md');
if (!fs.existsSync(securityDoc)) failures.push('docs/security.md: missing security baseline documentation');

if (failures.length) {
  console.error('Repository security baseline FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Repository security baseline PASS: ${workflowFiles().length} workflow files inspected.`);
console.log('Controls: no pull_request_target, no write-all, only isolated-repair/green-merge workflows may request contents:write, explicit permissions, lockfile, security documentation.');
