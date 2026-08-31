import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'artifacts/ci/g3/all';
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.json')) files.push(full);
  }
}
await walk(root).catch(() => {});
const records = [];
for (const file of files) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (Array.isArray(value.results)) records.push(...value.results.filter(x => x && x.gate && x.status));
    else if (value.gate && value.status) records.push(value);
    else if (value.runs?.A && value.gate) records.push(value);
  } catch {}
}

const required = [
  'G3-00','G3-01','G3-02','G3-03','G3-10','G3-11','G3-12','G3-13','G3-14',
  'G3-20','G3-21','G3-22','G3-23','G3-24','G3-25','G3-26','G3-27','G3-28','G3-29','G3-30','G3-31',
  'G3-40','G3-41','G3-42','G3-43','G3-44','G3-45','G3-46','G3-47',
  'G3-50','G3-51','G3-52','G3-53','G3-54','G3-55','G3-56','G3-60','G3-61','G3-62','G3-63','G3-64','G3-65',
  'G3-70','G3-71','G3-72','G3-73','G3-74','G3-80','G3-81','G3-82','G3-83','G3-84','G3-85',
  'G3-90','G3-91','G3-92','G3-93','G3-94','G3-95','G3-96','G3-97','G3-DET'
];
const byGate = new Map();
for (const r of records) {
  const gate = String(r.gate).split('..')[0].split('/')[0];
  if (!byGate.has(gate)) byGate.set(gate, []);
  byGate.get(gate).push(r);
}
const testedSha = process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
const missing = required.filter(g => ![...byGate.keys()].some(k => k === g || k.startsWith(`${g}-`)));
const shaMismatches = records.filter(r => r.sha && r.sha !== 'unknown' && r.sha !== testedSha);
const failures = records.filter(r => r.status === 'FAIL' || r.status === 'BLOCKED');

const grouped = new Map();
for (const failure of failures) {
  const rootCause = failure.rootCause || failure.class || 'UNKNOWN';
  if (!grouped.has(rootCause)) grouped.set(rootCause, []);
  grouped.get(rootCause).push(failure.gate);
}
const primary = [...grouped.entries()].sort((a,b) => b[1].length - a[1].length)[0] ?? null;

const legacyFound = process.env.LEGACY_RESULT === 'success';
const parity = failures.length === 0 && legacyFound ? 'PASS' : legacyFound ? 'DIFFERENCE_REQUIRES_REVIEW' : 'NOT_PROVEN';
const report = {
  gate: 'G3-AGGREGATOR', status: failures.length === 0 && missing.length === 0 && shaMismatches.length === 0 && parity === 'PASS' ? 'PASS' : 'FAIL',
  testedSha, baseSha: process.env.BASE_SHA || null, headSha: process.env.HEAD_SHA || testedSha, mergeSha: process.env.MERGE_SHA || null,
  runId: process.env.GITHUB_RUN_ID || null, attempt: Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
  totalRequiredGates: required.length, evidenceRecords: records.length, missing, shaMismatches,
  passed: records.filter(r => r.status === 'PASS').length, failed: failures.length, blocked: records.filter(r => r.status === 'BLOCKED').length,
  primaryRootCause: primary ? { rootCause: primary[0], gates: primary[1], derivedFailures: primary[1].slice(1) } : null,
  rootCauseGroups: Object.fromEntries(grouped),
  parity,
  promotion: { required: true, authoritative: failures.length === 0 && missing.length === 0 && shaMismatches.length === 0 && parity === 'PASS' },
};
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/aggregator.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
