import { WRITE_CAPABLE_WORKFLOWS, SECURITY_CRITICAL_WORKFLOWS } from './control-plane-registry.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const failures = [];

// Write-capable workflows are restricted to the bounded repair control plane.
// execution-sync is the canonical execution-branch reconciliation controller; it
// may write only to execution and trigger canonical CI, and it merges only after
// exact-head GREEN evidence. Direct-main repair remains intentionally forbidden.
const writeWorkflowAllowlist = new Set(WRITE_CAPABLE_WORKFLOWS);

const securityCriticalWorkflows = new Set(SECURITY_CRITICAL_WORKFLOWS);

const trustPerimeter = [
  '.github/workflows/auto-repair.yml',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/auto-repair-proof.mjs',
  'scripts/ci/auto-repair/',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repository-security-baseline.mjs',
  'scripts/ci/validate-auto-repair-memory.mjs',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-ci-cd-trust.mjs',
  'scripts/ci/validate-wp0-trust-baseline.mjs',
];

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

const policyPath = path.join(root, 'scripts', 'ci', 'auto-repair-policy.mjs');
const policyText = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, 'utf8') : '';
for (const protectedPath of trustPerimeter) {
  if (!policyText.includes("'" + protectedPath + "'")) failures.push('auto-repair-policy: missing protected trust path ' + protectedPath);
}
if (policyText.includes('maxAttemptsPerFingerprint: Number.POSITIVE_INFINITY')) failures.push('auto-repair-policy: unbounded per-fingerprint repair is forbidden');
if (/openDraftPrOnly:\s*true/u.test(policyText)) failures.push('auto-repair-policy: openDraftPrOnly=true contradicts canonical execution→main publication');

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

  if (securityCriticalWorkflows.has(relative)) {
    for (const match of text.matchAll(/^\s*uses:\s*([^\s#]+)@([^\s#]+)\s*$/gmu)) {
      const actionRef = match[2];
      if (!/^[a-f0-9]{40}$/u.test(actionRef)) {
        failures.push(`${relative}: security-critical workflow action must use an immutable 40-hex SHA; found ${actionRef}`);
      }
    }
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
