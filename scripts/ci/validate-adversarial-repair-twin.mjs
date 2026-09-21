#!/usr/bin/env node
import fs from 'node:fs';

const arg = (name) => {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
};

const file = arg('file');
const targetSha = arg('target-sha');
const targetRunId = arg('target-run-id');
const variant = arg('variant');

if (!/^\/tmp\/flixo-twin-[ab]\.json$/.test(file)) {
  throw new Error('TWIN_PATH_NOT_FIXED_INTERNAL');
}
if (!/^[a-f0-9]{40}$/i.test(targetSha)) throw new Error('TWIN_TARGET_SHA_INVALID');
if (!/^\d+$/.test(targetRunId)) throw new Error('TWIN_RUN_ID_INVALID');
if (!/^[AB]$/.test(variant)) throw new Error('TWIN_VARIANT_INVALID');

const stat = fs.statSync(file);
if (stat.size <= 0 || stat.size > 262144) throw new Error('TWIN_PAYLOAD_SIZE_OUT_OF_BOUNDS');

const value = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = {
  schemaVersion: 1,
  protocol: 'FLIXO-ADVERSARIAL-REPAIR-TWIN-v2',
  authority: 'READ_ONLY_ADVERSARIAL_TWIN',
  mutationAuthority: false,
  repositoryWrite: false,
  actionsWrite: false,
  branch: 'execution',
  targetRunId,
  targetSha,
  expectedSha: targetSha,
  twinVariant: variant,
};

for (const [key, expected] of Object.entries(required)) {
  if (value?.[key] !== expected) throw new Error(`TWIN_PROVENANCE_MISMATCH:${key}`);
}

if (!value?.independentDiagnosis || typeof value.independentDiagnosis !== 'object') {
  throw new Error('TWIN_SCHEMA_INDEPENDENT_DIAGNOSIS_MISSING');
}
if (!value?.challenge || typeof value.challenge !== 'object') {
  throw new Error('TWIN_SCHEMA_CHALLENGE_MISSING');
}
if (value.challenge.rule !== 'NEVER_WRITE_SOURCE_AND_NEVER_CONTROL_ACTIONS') {
  throw new Error('TWIN_SCHEMA_MUTATION_RULE_INVALID');
}
if (typeof value.challenge.preferredAlternativeStrategy !== 'string') {
  throw new Error('TWIN_SCHEMA_STRATEGY_INVALID');
}
if (typeof value.challenge.preferredAlternativeRepair !== 'string') {
  throw new Error('TWIN_SCHEMA_REPAIR_INVALID');
}
if (typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(value.fingerprint)) {
  throw new Error('TWIN_FINGERPRINT_INVALID');
}
if (typeof value.evidenceDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(value.evidenceDigest)) {
  throw new Error('TWIN_EVIDENCE_DIGEST_INVALID');
}
console.log(`ADVERSARIAL_TWIN_VALIDATED variant=${variant} sha=${targetSha}`);
