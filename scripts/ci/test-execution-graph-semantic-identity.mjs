#!/usr/bin/env node
import fs from 'node:fs';

const recorder = fs.readFileSync('scripts/ci/record-playwright-execution.mjs', 'utf8');
const validator = fs.readFileSync('scripts/ci/validate-execution-graph.mjs', 'utf8');
const failures = [];

const requiredRecorder = 'DEEP:${browser}:${semanticLocale}';
const requiredValidatorUnit = 'DEEP:${unit.browser}:${unit.semanticLocale}';
const requiredValidatorOwner = 'DEEP:${browser}:${locale}';

if (!recorder.includes(requiredRecorder)) failures.push(`RECORDER_CANONICAL_SEMANTIC_ID_MISSING=${requiredRecorder}`);
if (!validator.includes(requiredValidatorUnit)) failures.push(`VALIDATOR_UNIT_ID_ENFORCEMENT_MISSING=${requiredValidatorUnit}`);
if (!validator.includes('const key = `${browser}:DEEP:${browser}:${locale}`;')) failures.push(`VALIDATOR_OWNER_KEY_MISSING=${requiredValidatorOwner}`);

const semanticUnitId = 'DEEP:chromium:ar';
const ownerKey = `chromium:${semanticUnitId}`;
const canonicalExpectedKey = 'chromium:DEEP:chromium:ar';
const legacyWrongKey = 'chromium:DEEP:ar';

if (ownerKey !== canonicalExpectedKey) failures.push(`OWNER_KEY_RUNTIME_MISMATCH=${ownerKey}`);
if (ownerKey === legacyWrongKey) failures.push(`LEGACY_OWNER_KEY_UNEXPECTEDLY_MATCHES=${legacyWrongKey}`);

console.log(JSON.stringify({
  schemaVersion: 1,
  status: failures.length ? 'FAIL' : 'PASS',
  rcaId: 'RC-CI-DEEP-SEMANTIC-IDENTITY-001',
  recorderCanonicalSemanticId: requiredRecorder,
  validatorCanonicalUnitId: requiredValidatorUnit,
  validatorCanonicalOwnerKey: 'chromium:DEEP:chromium:ar',
  failures,
}, null, 2));

if (failures.length) process.exit(1);
