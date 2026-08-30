import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const workflowsDir = '.github/workflows';
const files = readdirSync(workflowsDir).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));
const contents = new Map(files.map((file) => [file, readFileSync(join(workflowsDir, file), 'utf8')]));

const blockingSurfaces = [
  'TypeScript', 'ESLint', 'Fast Contract Diagnostics', 'S3 Static Gate',
  'Socket Supply Chain', 'CodeQL', 'Secret History Scan', 'Canonical Verification Gate', 'CI',
];

const owners = new Map();
for (const [file, text] of contents) {
  for (const surface of blockingSurfaces) {
    if (text.includes(`name: ${surface}`)) {
      if (owners.has(surface)) {
        throw new Error(`CI architecture violation: ${surface} has multiple workflow owners: ${owners.get(surface)} and ${file}`);
      }
      owners.set(surface, file);
    }
  }
}

const ci = contents.get('ci.yml') ?? '';
if (!ci.includes('canonical-verify:')) throw new Error('CI architecture violation: canonical aggregator is missing');
if (!ci.includes('ci:\n')) throw new Error('CI architecture violation: CI gate is missing');

const canonical = ci.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
for (const forbidden of [/npm\s+run\s+verify/, /npm\s+test(?![\w-])/, /npm\s+run\s+build/]) {
  if (forbidden.test(canonical)) throw new Error(`CI architecture violation: canonical reruns execution (${forbidden})`);
}

const workflowBuildConsumers = ['s3-static-gate.yml', 'seo-production-certification.yml'];
for (const file of workflowBuildConsumers) {
  const text = contents.get(file) ?? '';
  if (/npm\s+run\s+build(?:[:\s]|$)/.test(text) && !/workflow_dispatch/.test(text)) {
    throw new Error(`CI architecture violation: ${file} performs a duplicate production build`);
  }
}

for (const pattern of [/\bif-no-files-found:\s*warn\b/, /continue-on-error:\s*true/]) {
  if (pattern.test(canonical)) throw new Error(`CI architecture violation: canonical contains a non-fail-closed execution control ${pattern}`);
}

console.log(JSON.stringify({
  schema_version: 1,
  owners: Object.fromEntries(owners),
  checks: {
    unique_blocking_owners: true,
    canonical_aggregator_only: true,
    duplicate_builds_blocked: true,
    fail_closed_controls: true,
  },
}, null, 2));
