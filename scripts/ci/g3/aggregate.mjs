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
await walk(root).catch((error) => {
  console.error(`G3 aggregation input scan failed: ${error instanceof Error ? error.message : String(error)}`);
});

const records = [];
for (const file of files) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    const candidates = Array.isArray(value.results)
      ? value.results
      : value.gate && value.status
        ? [value]
        : value.runs?.A && value.gate
          ? [value]
          : [];
    for (const record of candidates) {
      if (!record || !record.status) continue;
      const gates = String(record.gate ?? '').match(/G3-\d+/g) ?? [];
      for (const gate of gates) records.push({ ...record, gate, evidenceSource: file });
    }
  } catch (error) {
    console.error(`G3 evidence parse failed for ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const required = [
  'G3-00','G3-01','G3-02','G3-03','G3-10','G3-11','G3-12','G3-13','G3-14',
  'G3-20','G3-21','G3-22','G3-23','G3-24','G3-25','G3-26','G3-27','G3-28','G3-29','G3-30','G3-31',
  'G3-40','G3-41','G3-42','G3-43','G3-44','G3-45','G3-46','G3-47',
  'G3-50','G3-51','G3-52','G3-53','G3-54','G3-55','G3-56','G3-60','G3-61','G3-62','G3-63','G3-64','G3-65',
  'G3-70','G3-71','G3-72','G3-73','G3-74','G3-80','G3-81','G3-82','G3-83','G3-84','G3-85',
  'G3-90','G3-91','G3-92','G3-93','G3-94','G3-95','G3-96','G3-97','G3-DET'
];

const testedSha = process.env.EXPECTED_HEAD_SHA || process.env.HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
const fingerprint = (record) => JSON.stringify({
  gate: record.gate,
  status: record.status,
  sha: record.sha || 'unknown',
  rootCause: record.rootCause || null,
  class: record.class || record.classification || null,
  retryable: Boolean(record.retryable),
  derivedFrom: record.derivedFrom || null,
  blockedBy: record.blockedBy || null,
  assertion: record.assertion || null,
});

const exact = new Map();
for (const record of records) {
  if (!exact.has(record.gate)) exact.set(record.gate, []);
  exact.get(record.gate).push(record);
}

const conflicts = [];
const canonical = new Map();
for (const gate of required) {
  const gateRecords = exact.get(gate) ?? [];
  const byFingerprint = new Map();
  for (const record of gateRecords) {
    const fp = fingerprint(record);
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, record);
  }
  const unique = [...byFingerprint.values()];
  canonical.set(gate, unique[0] || {});
  if (unique.length > 1) {
    conflicts.push({ gate, count: unique.length, records: unique.map((record) => ({
      status: record.status,
      sha: record.sha || null,
      rootCause: record.rootCause || null,
      source: record.evidenceSource || null,
    })) });
  }
}

const missing = required.filter((gate) => !canonical.get(gate)?.status);
const shaMismatches = records.filter((record) => record.sha && record.sha !== 'unknown' && record.sha !== testedSha);
const ledger = required.map((gate) => {
  const source = canonical.get(gate) || {};
  return {
    gate,
    status: source.status || 'MISSING',
    sha: source.sha || testedSha,
    baseSha: source.baseSha || process.env.BASE_SHA || null,
    headSha: source.headSha || testedSha,
    mergeSha: source.mergeSha || process.env.MERGE_SHA || null,
    runId: source.runId || process.env.GITHUB_RUN_ID || null,
    attempt: source.attempt || Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
    environment: source.environment || { repository: process.env.GITHUB_REPOSITORY || null, event: process.env.GITHUB_EVENT_NAME || null, os: process.env.RUNNER_OS || null, arch: process.arch, node: process.version },
    command: source.command || null,
    durationMs: Number(source.durationMs || 0),
    stdout: source.stdout || '',
    stderr: source.stderr || '',
    artifacts: source.artifacts || [],
    hashes: source.hashes || {},
    classification: source.class || source.classification || null,
    rootCause: source.rootCause || null,
    retryable: Boolean(source.retryable),
    evidenceSource: source.evidenceSource || null,
  };
});

const gateFailures = ledger.filter((record) => record.status === 'FAIL' || record.status === 'BLOCKED');
const missingEvidenceFields = ledger.filter((record) => !record.command || !record.runId || !record.sha || !record.headSha).map((record) => record.gate);
const grouped = new Map();
for (const failure of gateFailures) {
  const rootCause = failure.rootCause || failure.classification || 'UNKNOWN';
  if (!grouped.has(rootCause)) grouped.set(rootCause, []);
  grouped.get(rootCause).push(failure.gate);
}
const primary = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? null;
const legacyFound = process.env.LEGACY_RESULT === 'success';
const parity = gateFailures.length === 0 && missing.length === 0 && conflicts.length === 0 && legacyFound ? 'PASS' : legacyFound ? 'DIFFERENCE_REQUIRES_REVIEW' : 'NOT_PROVEN';
const authoritative = gateFailures.length === 0 && missing.length === 0 && conflicts.length === 0 && shaMismatches.length === 0 && missingEvidenceFields.length === 0 && parity === 'PASS';

const report = {
  gate: 'G3-AGGREGATOR',
  status: authoritative ? 'PASS' : 'FAIL',
  testedSha,
  baseSha: process.env.BASE_SHA || null,
  headSha: process.env.HEAD_SHA || testedSha,
  mergeSha: process.env.MERGE_SHA || null,
  runId: process.env.GITHUB_RUN_ID || null,
  attempt: Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
  totalRequiredGates: required.length,
  evidenceRecords: records.length,
  passed: ledger.filter((record) => record.status === 'PASS').length,
  failed: ledger.filter((record) => record.status === 'FAIL').length,
  blocked: ledger.filter((record) => record.status === 'BLOCKED').length,
  missing,
  conflicts,
  shaMismatches,
  missingEvidenceFields,
  primaryRootCause: primary ? { rootCause: primary[0], gates: primary[1], derivedFailures: primary[1].slice(1) } : null,
  rootCauseGroups: Object.fromEntries(grouped),
  parity,
  evidenceCoverage: ledger.length === required.length && missingEvidenceFields.length === 0,
  promotion: { required: true, authoritative },
  evidenceLedger: ledger,
};
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/aggregator.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, evidenceLedger: undefined }, null, 2));
if (!authoritative) process.exit(1);
