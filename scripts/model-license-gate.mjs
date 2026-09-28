import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs', 'MODEL_LICENSE_MANIFEST.json');
const policyPath = path.join(root, 'docs', 'MODEL-LICENSE-POLICY.json');
const requireEntry = process.argv.includes('--require-entry');

const fail = (message) => {
  console.error('[model-license-gate] BLOCKED:', message);
  process.exitCode = 1;
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read valid JSON: ${path.relative(root, file)}`);
    throw error;
  }
}

const manifest = readJson(manifestPath);
const policy = readJson(policyPath);

if (manifest?.schema_version !== '1.0.0') fail('unsupported manifest schema.');
if (manifest?.status !== 'ACTIVE') fail('manifest status must be ACTIVE.');
if (manifest?.authority !== 'FLIXO_CONTROL_PLANE') fail('manifest authority is not FLIXO_CONTROL_PLANE.');
if (manifest?.rules?.latest_version_allowed !== false) fail('latest-version selection must remain disabled.');
if (manifest?.rules?.automatic_promotion_allowed !== false) fail('automatic promotion must remain disabled.');
if (manifest?.rules?.automatic_license_acceptance_allowed !== false) fail('automatic license acceptance must remain disabled.');
if (!Array.isArray(manifest?.entries)) fail('entries must be an array.');
if (!Array.isArray(policy?.license_classes?.approved_for_initial_review)) fail('policy approved license classes are missing.');

const required = new Set(manifest.required_fields ?? []);
const statuses = new Set(manifest.review_status_values ?? []);
const seen = new Set();

for (const [index, entry] of manifest.entries.entries()) {
  if (!entry || typeof entry !== 'object') { fail(`entry[${index}] is not an object.`); continue; }
  for (const field of required) {
    if (!(field in entry)) fail(`entry[${index}] is missing ${field}.`);
  }
  if (typeof entry.model !== 'string' || !entry.model.trim()) fail(`entry[${index}] model is empty.`);
  if (typeof entry.version !== 'string' || !entry.version.trim()) fail(`entry[${index}] version is empty.`);
  const identity = `${entry.model}@${entry.version}`;
  if (seen.has(identity)) fail(`duplicate model identity: ${identity}`);
  seen.add(identity);
  if (!statuses.has(entry.review_status)) fail(`entry[${index}] has invalid review_status.`);
  if (entry.review_status !== 'PASS') fail(`entry[${index}] is not production-admissible: ${identity}`);
  if (entry.lifecycle_status && !['CANDIDATE','APPROVED','ACTIVE','QUARANTINED'].includes(entry.lifecycle_status)) {
    fail(`entry[${index}] has invalid lifecycle_status.`);
  }
  if (!/^[a-f0-9]{64}$/iu.test(String(entry.artifact_sha256 ?? ''))) fail(`entry[${index}] artifact_sha256 is not a 64-hex SHA-256.`);
  if (!Array.isArray(entry.fallback_models)) fail(`entry[${index}] fallback_models must be an array.`);
  if (entry.fallback_models.includes(identity)) fail(`entry[${index}] cannot fallback to itself.`);
  if (entry.review_status === 'PASS' && entry.lifecycle_status !== 'ACTIVE') fail(`entry[${index}] PASS entry must be ACTIVE.`);
}

if (requireEntry && manifest.entries.length === 0) fail('no model is registered; release admission requires at least one evidenced model.');

if (process.exitCode) process.exit(1);
console.log(`[model-license-gate] PASS: manifest structure and fail-closed policy verified; entries=${manifest.entries.length}`);
if (manifest.entries.length === 0) console.log('[model-license-gate] NOTE: no production model is admitted yet; release gate remains blocked until exact evidence is registered.');
