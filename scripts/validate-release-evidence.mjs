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
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const allowedTopLevel = new Set(['schemaVersion', 'commitSha', 'verification', 'deployment', 'runtime', 'artifact']);
const allowedVerification = new Set(['state', 'canonicalGate', 'requiredChecks']);
const allowedDeployment = new Set(['state', 'provider', 'deploymentId']);
const allowedRuntime = new Set(['state', 'evidenceId', 'observedAt']);
const allowedArtifact = new Set(['id', 'sha256']);

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

let evidence;
try {
  evidence = await readJson(evidencePath);
} catch (error) {
  console.error(`FLIXO release evidence: FAIL - cannot read valid JSON (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}

const rejectUnknown = (value, allowed, prefix) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) failures.push(`${prefix}.${key} is not allowed`);
  }
};

if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
  failures.push('evidence must be a JSON object');
} else {
  rejectUnknown(evidence, allowedTopLevel, 'evidence');

  if (evidence.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (typeof evidence.commitSha !== 'string' || !sha40.test(evidence.commitSha)) failures.push('commitSha must be a lowercase 40-character SHA');

  const verification = evidence.verification;
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    failures.push('verification is required and must be an object');
  } else {
    rejectUnknown(verification, allowedVerification, 'verification');
    for (const key of allowedVerification) {
      if (!(key in verification)) failures.push(`verification.${key} is required`);
    }
    for (const key of ['state', 'canonicalGate', 'requiredChecks']) {
      if (!['passed', 'failed', 'unknown'].includes(verification[key])) {
        failures.push(`verification.${key} must be passed, failed, or unknown`);
      }
    }
  }

  const deployment = evidence.deployment;
  if (!deployment || typeof deployment !== 'object' || Array.isArray(deployment)) {
    failures.push('deployment is required and must be an object');
  } else {
    rejectUnknown(deployment, allowedDeployment, 'deployment');
    if (!['deployed', 'blocked', 'failed', 'unknown'].includes(deployment.state)) failures.push('deployment.state is invalid');
    for (const key of ['provider', 'deploymentId']) {
      if (deployment[key] !== undefined && (typeof deployment[key] !== 'string' || deployment[key].trim() === '')) failures.push(`deployment.${key} must be a non-empty string when present`);
    }
  }

  const runtime = evidence.runtime;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    failures.push('runtime is required and must be an object');
  } else {
    rejectUnknown(runtime, allowedRuntime, 'runtime');
    if (!['healthy', 'degraded', 'failed', 'unknown'].includes(runtime.state)) failures.push('runtime.state is invalid');
    if (runtime.evidenceId !== undefined && (typeof runtime.evidenceId !== 'string' || runtime.evidenceId.trim() === '')) failures.push('runtime.evidenceId must be a non-empty string when present');
    if (runtime.observedAt !== undefined && (typeof runtime.observedAt !== 'string' || !dateTime.test(runtime.observedAt))) failures.push('runtime.observedAt must be an ISO UTC date-time');
  }

  if (evidence.artifact !== undefined) {
    const artifact = evidence.artifact;
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      failures.push('artifact must be an object when present');
    } else {
      rejectUnknown(artifact, allowedArtifact, 'artifact');
      if (artifact.id !== undefined && (typeof artifact.id !== 'string' || artifact.id.trim() === '')) failures.push('artifact.id must be a non-empty string when present');
      if (artifact.sha256 !== undefined && (typeof artifact.sha256 !== 'string' || !sha64.test(artifact.sha256))) failures.push('artifact.sha256 must be a lowercase 64-character SHA-256');
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
