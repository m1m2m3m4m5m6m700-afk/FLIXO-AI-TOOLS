#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'docs/MODEL_LICENSE_MANIFEST.json');
const policyPath = resolve(root, 'docs/MODEL-LICENSE-POLICY.json');

const required = [
  'model', 'version', 'source', 'license', 'license_file',
  'artifact_sha256', 'download_date', 'commercial_use',
  'fine_tuning', 'redistribution', 'distillation', 'adapter_policy',
  'acceptable_use_policy', 'trademark_restrictions',
  'training_data_restrictions', 'provenance_status',
  'FLIXO_owned_layer', 'fallback_models', 'review_status',
];
const statuses = new Set(['PASS', 'REVIEW_REQUIRED', 'BLOCKED', 'UNKNOWN']);
const requireEntries = process.argv.includes('--require-entry');

const fail = (message) => {
  console.error('[MODEL-LICENSE-GATE] BLOCKED: ' + message);
  process.exitCode = 1;
};

const [manifest, policy] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(policyPath, 'utf8').then(JSON.parse),
]);

if (manifest.schema_version !== '1.0.0') fail('Unsupported manifest schema.');
if (!Array.isArray(manifest.entries)) fail('manifest.entries must be an array.');
if (!Array.isArray(policy.gate_outcomes)) fail('Policy gate outcomes are missing.');
if (manifest.rules?.latest_version_allowed !== false) fail('latest-version references must remain disabled.');
if (manifest.rules?.automatic_promotion_allowed !== false) fail('automatic model promotion must remain disabled.');
if (manifest.rules?.automatic_license_acceptance_allowed !== false) fail('automatic license acceptance must remain disabled.');
if (requireEntries && manifest.entries.length === 0) fail('No model entries exist; production inventory is incomplete.');

const seen = new Set();

for (const entry of manifest.entries) {
  if (!entry || typeof entry !== 'object') {
    fail('Every manifest entry must be an object.');
    continue;
  }

  const identity = entry.model + '@' + entry.version;
  if (seen.has(identity)) fail('Duplicate model identity: ' + identity);
  seen.add(identity);

  for (const field of required) {
    if (!(field in entry)) fail(identity + ' is missing required field: ' + field);
  }

  if (!statuses.has(entry.review_status)) {
    fail(identity + ' has invalid review_status: ' + entry.review_status);
  }

  if (entry.artifact_sha256 && !/^[a-f0-9]{64}$/i.test(entry.artifact_sha256)) {
    fail(identity + ' has an invalid artifact_sha256.');
  }

  if (Array.isArray(entry.fallback_models) && entry.fallback_models.includes(identity)) {
    fail(identity + ' cannot list itself as its fallback.');
  }

  if (entry.review_status !== 'PASS') {
    console.error('[MODEL-LICENSE-GATE] ' + identity + ': ' + entry.review_status);
  }
}

if (process.exitCode) process.exit(process.exitCode);

console.log('[MODEL-LICENSE-GATE] PASS: manifest structure and admission rules are valid.');
if (manifest.entries.length === 0) {
  console.log('[MODEL-LICENSE-GATE] NOTICE: inventory is empty; use --require-entry to enforce production inventory.');
}
