import { REPAIR_GATE_AUTOMATION, WRITE_CAPABLE_WORKFLOWS, SECURITY_CRITICAL_WORKFLOWS, SENSITIVE_PERMISSION_ALLOWLISTS, TRUST_PERIMETER_PATHS } from './control-plane-registry.mjs';
import { isProtectedPath } from './auto-repair-policy.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const failures = [];

// Write-capable workflows are restricted to the bounded repair control plane.
// execution-sync is the canonical execution-branch reconciliation controller; it
// may write only to execution and trigger canonical CI, and it merges only after
// exact-head GREEN evidence. Direct-main repair remains intentionally forbidden.
const writePermissionAllowlists = new Map(
  Object.entries(SENSITIVE_PERMISSION_ALLOWLISTS).map(([permission, workflowNames]) => [
    permission,
    new Set(workflowNames.map((name) => `.github/workflows/${name}`)),
  ]),
);

const securityCriticalWorkflows = new Set(SECURITY_CRITICAL_WORKFLOWS.map((name) => `.github/workflows/${name}`));

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

for (const protectedPath of TRUST_PERIMETER_PATHS) {
  const absolute = path.join(root, protectedPath);
  if (!isProtectedPath(protectedPath)) {
    failures.push('auto-repair-policy: trust perimeter path is not protected ' + protectedPath);
  }
  if (!fs.existsSync(absolute)) {
    failures.push('control-plane-registry: missing trust perimeter path ' + protectedPath);
  }
}
if (policyText.includes('maxAttemptsPerFingerprint: Number.POSITIVE_INFINITY')) failures.push('auto-repair-policy: unbounded per-fingerprint repair is forbidden');
if (/openDraftPrOnly:\s*true/u.test(policyText)) failures.push('auto-repair-policy: openDraftPrOnly=true contradicts canonical execution→main publication');

for (const workflowName of [...REPAIR_GATE_AUTOMATION, ...WRITE_CAPABLE_WORKFLOWS, ...SECURITY_CRITICAL_WORKFLOWS]) {
  if (!fs.existsSync(path.join(workflowDir, workflowName))) {
    failures.push(`control-plane-registry: missing declared workflow ${workflowName}`);
  }
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

  for (const match of text.matchAll(/^\s*([A-Za-z0-9_-]+)\s*:\s*write\s*$/gmu)) {
    const permission = match[1];
    const allowlist = writePermissionAllowlists.get(permission);
    if (!allowlist || !allowlist.has(relative)) {
      failures.push(`${relative}: ${permission}: write requires explicit sensitive-permission allowlisting`);
    }
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
console.log('Controls: no pull_request_target, no write-all, all workflow write permissions are explicitly allowlisted, privileged trust-boundary workflows require immutable actions, explicit permissions, lockfile, security documentation.');
