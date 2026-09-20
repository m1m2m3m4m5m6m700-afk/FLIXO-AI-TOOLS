import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-historical-index-'));
fs.mkdirSync(path.join(dir, 'records'), { recursive: true });
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({
  schemaVersion: 2,
  authority: 'HISTORICAL_OBSERVATION_ONLY',
  source: 'github-actions-logs',
  externalDiagnosis: false,
  proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY',
  byFingerprint: {},
  byNormalized: {},
  byClass: {},
  byWorkflow: {},
  recordCount: 0,
  updatedAt: null,
}));
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  schemaVersion: 2,
  name: 'FLIXO-HISTORICAL-ACTION-ERROR-CORPUS',
  source: 'github-actions-logs',
  authority: 'historical-observation',
  externalDiagnosis: false,
  exactShaRequired: true,
  repositoryCreatedAt: '2026-08-10T14:20:17Z',
  coverageStart: null,
  coverageEnd: null,
  totalRunsScanned: 0,
  failedRunsScanned: 0,
  jobsScanned: 0,
  logJobsScanned: 0,
  errorOccurrences: 0,
  uniqueRecords: 0,
  shards: [],
  updatedAt: null,
}));

process.env.FLIXO_HISTORICAL_ERROR_DIR = dir;
const mod = await import('./historical-action-error-index.mjs?test=' + Date.now());
const digestInput = { occurrences: [{
  workflow: 'CI',
  job: 'Static',
  runId: '123',
  sha: 'a'.repeat(40),
  branch: 'execution',
  rawLine: 'error TS2304: Cannot find name "video".',
  seenAt: '2026-09-20T00:00:00Z',
}], runCount: 1, failedRunCount: 1, jobCount: 1, logJobCount: 1, start: '2026-08-10T00:00:00Z', end: '2026-08-11T00:00:00Z' };
const merged = mod.mergeOccurrences(digestInput);
assert.equal(merged.uniqueRecords, 1);
assert.equal(merged.errorOccurrences, 1);

const records = mod.query('error TS2304: Cannot find name "video".', 10);
assert.equal(records.length, 1);
assert.equal(records[0].errorClass, 'typescript');
assert.equal(records[0].runs[0], '123');

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
assert.equal(manifest.source, 'github-actions-logs');
assert.equal(manifest.externalDiagnosis, false);
assert.equal(manifest.uniqueRecords, 1);
assert.equal(manifest.errorOccurrences, 1);

fs.rmSync(dir, { recursive: true, force: true });
console.log('HISTORICAL_ACTION_ERROR_INDEX=PASS');
