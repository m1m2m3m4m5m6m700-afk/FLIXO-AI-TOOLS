import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const evidencePath = process.argv[2] ?? process.env.FLIXO_RELEASE_EVIDENCE;

if (!evidencePath) {
  console.error('Usage: node scripts/validate-release-evidence.mjs <evidence.json>');
  process.exit(2);
}

const failures = [];
const sha40 = /^[0-9a-f]{40}$/;
const sha64 = /^[0-9a-f]{64}$/;
const dateTime = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$/;

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const evidence = await readJson(evidencePath);

if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
  failures.push('evidence must be a JSON object');
} else {
  if (evidence.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (typeof evidence.commitSha !== 'string' || !sha40.test(evidence.commitSha)) failures.push('commitSha must be a lowercase 40-character SHA');

  const verification = evidence.verification;
  if (!verification || typeof verification !== 'object') {
    failures.push('verification is required');
  } else {
    for (const key of ['state', 'canonicalGate', 'requiredChecks']) {
      if (!['passed', 'failed', 'unknown'].includes(verification[key])) {
        failures.push(`verification.${key} must be passed, failed, or unknown`);
      }
    }
  }

  const deployment = evidence.deployment;
  if (!deployment || typeof deployment !== 'object') {
    failures.push('deployment is required');
  } else if (!['deployed', 'blocked', 'failed', 'unknown'].includes(deployment.state)) {
    failures.push('deployment.state is invalid');
  }

  const runtime = evidence.runtime;
  if (!runtime || typeof runtime !== 'object') {
    failures.push('runtime is required');
  } else {
    if (!['healthy', 'degraded', 'failed', 'unknown'].includes(runtime.state)) failures.push('runtime.state is invalid');
    if (runtime.observedAt !== undefined && (typeof runtime.observedAt !== 'string' || !dateTime.test(runtime.observedAt))) {
      failures.push('runtime.observedAt must be an ISO UTC date-time');
    }
  }

  if (evidence.artifact !== undefined) {
    if (!evidence.artifact || typeof evidence.artifact !== 'object') {
      failures.push('artifact must be an object');
    } else if (evidence.artifact.sha256 !== undefined && (typeof evidence.artifact.sha256 !== 'string' || !sha64.test(evidence.artifact.sha256))) {
      failures.push('artifact.sha256 must be a lowercase 64-character SHA-256');
    }
  }
}

if (failures.length > 0) {
  console.error('FLIXO release evidence: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FLIXO release evidence: PASS');
console.log(`commitSha: ${evidence.commitSha}`);
console.log(`verification: ${evidence.verification.state}`);
console.log(`deployment: ${evidence.deployment.state}`);
console.log(`runtime: ${evidence.runtime.state}`);
