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
for (const [index, record] of records.entries()) {
  for (const key of ['sha', 'gate', 'expected', 'executed', 'passed', 'failed', 'skipped', 'missing', 'result']) {
    if (!(key in record)) errors.push(`${files[index]} missing ${key}`);
  }
  if (record.sha !== sha) errors.push(`${files[index]} SHA mismatch: ${record.sha} != ${sha}`);
  if (record.result !== 'PASS') errors.push(`${files[index]} result=${record.result}`);
  if (record.failed !== 0) errors.push(`${files[index]} failed=${record.failed}`);
  if (record.skipped !== 0) errors.push(`${files[index]} skipped=${record.skipped}`);
  if (record.missing !== 0) errors.push(`${files[index]} missing=${record.missing}`);
  if (record.executed !== record.expected) errors.push(`${files[index]} executed=${record.executed} expected=${record.expected}`);
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
