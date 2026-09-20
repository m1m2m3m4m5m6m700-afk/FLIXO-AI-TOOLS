import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.EVIDENCE_ROOT || 'ci-evidence';
const sha = process.env.EXACT_SHA || process.env.GITHUB_SHA;
if (!sha) throw new Error('EXACT_SHA/GITHUB_SHA is required.');

const files = statSync(root, { throwIfNoEntry: false })?.isDirectory()
  ? readdirSync(root).filter((name) => name.endsWith('.json')).map((name) => join(root, name))
  : [];
if (!files.length) throw new Error('Evidence ledger is empty: missing evidence is a hard failure.');

const records = files.map((file) => JSON.parse(readFileSync(file, 'utf8')));
const errors = [];
const normalizeResult = (value) => {
  switch (String(value).toLowerCase()) {
    case 'success': case 'pass': return 'PASS';
    case 'failure': case 'fail': return 'FAIL';
    case 'skipped': case 'skip': return 'SKIP';
    default: return 'MISSING';
  }
};
for (const [index, record] of records.entries()) {
  const file = files[index];
  for (const key of ['sha', 'gate', 'expected', 'executed', 'passed', 'failed', 'skipped', 'missing', 'result']) {
    if (!(key in record)) errors.push(`${file} missing ${key}`);
  }
  const result = normalizeResult(record.result);
  if (record.sha !== sha) errors.push(`${file} SHA mismatch: ${record.sha} != ${sha}`);
  if (result !== 'PASS') errors.push(`${file} result=${result}`);
  if (record.failed !== 0) errors.push(`${file} failed=${record.failed}`);
  if (record.skipped !== 0) errors.push(`${file} skipped=${record.skipped}`);
  if (record.missing !== 0) errors.push(`${file} missing=${record.missing}`);
  if (record.executed !== record.expected) errors.push(`${file} executed=${record.executed} expected=${record.expected}`);
}

const summary = {
  sha,
  records: records.length,
  expected: records.reduce((sum, r) => sum + Number(r.expected), 0),
  executed: records.reduce((sum, r) => sum + Number(r.executed), 0),
  passed: records.reduce((sum, r) => sum + Number(r.passed), 0),
  failed: records.reduce((sum, r) => sum + Number(r.failed), 0),
  skipped: records.reduce((sum, r) => sum + Number(r.skipped), 0),
  missing: records.reduce((sum, r) => sum + Number(r.missing), 0)
};
summary.result = errors.length ? 'FAIL' : 'PASS';
console.log(JSON.stringify({ summary, errors }, null, 2));
if (errors.length) process.exit(1);
