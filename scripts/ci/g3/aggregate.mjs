import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'artifacts/ci/g3/all';
const testedSha = process.env.EXPECTED_HEAD_SHA || process.env.HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
const runId = process.env.GITHUB_RUN_ID || null;
const baseSha = process.env.BASE_SHA || null;
const mergeSha = process.env.MERGE_SHA || null;

const commandForGate = (gate) => {
  if (gate === 'G3-00') return 'node scripts/ci/g3/identity.mjs';
  if (/^G3-0[123]$/.test(gate)) return 'node scripts/ci/g3/environment.mjs';
  if (/^G3-1[123]$/.test(gate)) return gate === 'G3-11' ? 'npx tsc --noEmit --pretty false' : gate === 'G3-12' ? 'npm run lint' : 'npm run build';
  if (gate === 'G3-14') return 'git rev-parse HEAD';
  if (/^G3-(2\d|3[01])$/.test(gate)) return 'node --experimental-strip-types scripts/ci/g3/artifact-gates.mjs';
  if (/^G3-4[0-7]$/.test(gate)) return 'node --experimental-strip-types scripts/ci/g3/processor.mjs';
  if (/^G3-5[0-6]$/.test(gate) || /^G3-6[0-5]$/.test(gate) || /^G3-7[0-4]$/.test(gate) || /^G3-8[0-5]$/.test(gate)) return 'node scripts/ci/g3/browser-gates.mjs';
  if (/^G3-9[0-7]$/.test(gate)) return 'node scripts/ci/g3/regression.mjs';
  if (gate === 'G3-DET') return 'node scripts/ci/g3/determinism.mjs';
  return null;
};

const expandGate = (value) => {
  const text = String(value ?? '').trim();
  if (text === 'G3-DET') return ['G3-DET'];
  const range = text.match(/^G3-(\d+)\.\.(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && start <= end) {
      return Array.from({ length: end - start + 1 }, (_, index) => `G3-${start + index}`);
    }
  }
  const matches = text.match(/G3-\d+/g) ?? [];
  return matches.length ? matches : [];
};

const normalizeRecord = (record, gate, evidenceSource) => ({
  ...record,
  gate,
  sha: record.sha || record.testedSha || testedSha,
  headSha: record.headSha || record.sha || testedSha,
  baseSha: record.baseSha || baseSha,
  mergeSha: record.mergeSha || mergeSha,
  runId: record.runId || runId,
  command: record.command || commandForGate(gate),
  evidenceSource,
});

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
      for (const gate of expandGate(record.gate)) {
        records.push(normalizeRecord(record, gate, file));
      }
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

const foundationResult = process.env.FOUNDATION_RESULT || 'unknown';
if (foundationResult === 'success') {
  const foundationGates = [
    ['G3-10', 'Dependencies', 'npm ci --prefer-offline --no-audit --no-fund'],
    ['G3-11', 'TypeScript', 'npx tsc --noEmit --pretty false'],
    ['G3-12', 'ESLint', 'npm run lint'],
    ['G3-13', 'Build', 'npm run build'],
    ['G3-14', 'Build Identity', 'git rev-parse HEAD'],
  ];
  for (const [gate, name, command] of foundationGates) {
    records.push({ gate, name, status: 'PASS', class: null, rootCause: null, retryable: false, sha: testedSha, durationMs: 0, command, stdout: '', stderr: '', baseSha, headSha: testedSha, mergeSha, runId, evidenceSource: 'job:g3-foundation' });
  }
}

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
for (const gate of required) {
  const gateRecords = records.filter((record) => record.gate === gate);
  const currentSha = gateRecords.filter((record) => record.sha === testedSha);
  const candidates = currentSha.length ? currentSha : gateRecords;
  const byFingerprint = new Map();
  for (const record of candidates) {
    const fp = fingerprint(record);
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, record);
  }
  exact.set(gate, { candidates, unique: [...byFingerprint.values()], hasCurrentSha: currentSha.length > 0 });
}

const conflicts = [];
const canonical = new Map();
for (const gate of required) {
  const unique = exact.get(gate)?.unique ?? [];
  canonical.set(gate, unique[0] || {});
  if (unique.length > 1) {
    conflicts.push({ gate, count: unique.length, records: unique.map((record) => ({ status: record.status, sha: record.sha || null, rootCause: record.rootCause || null, source: record.evidenceSource || null })) });
  }
}

const missing = required.filter((gate) => !canonical.get(gate)?.status);
const staleEvidence = records.filter((record) => record.sha && record.sha !== 'unknown' && record.sha !== testedSha);
const shaMismatches = required.map((gate) => canonical.get(gate) || {}).filter((record) => record.sha && record.sha !== 'unknown' && record.sha !== testedSha).map((record) => ({ gate: record.gate, status: record.status, sha: record.sha, expectedSha: testedSha, evidenceSource: record.evidenceSource || null }));

const ledger = required.map((gate) => {
  const source = canonical.get(gate) || {};
  return {
    gate,
    status: source.status || 'MISSING',
    sha: source.sha || testedSha,
    baseSha: source.baseSha || baseSha,
    headSha: source.headSha || testedSha,
    mergeSha: source.mergeSha || mergeSha,
    runId: source.runId || runId,
    attempt: source.attempt || Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
    environment: source.environment || { repository: process.env.GITHUB_REPOSITORY || null, event: process.env.GITHUB_EVENT_NAME || null, os: process.env.RUNNER_OS || null, arch: process.arch, node: process.version },
    command: source.command || commandForGate(gate),
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

const authoritativeInputsPass = gateFailures.length === 0
  && missing.length === 0
  && conflicts.length === 0
  && shaMismatches.length === 0
  && missingEvidenceFields.length === 0;
const parity = authoritativeInputsPass ? 'PASS' : 'NOT_PROVEN';
const authoritative = authoritativeInputsPass;

const report = {
  gate: 'G3-AGGREGATOR',
  status: authoritative ? 'PASS' : 'FAIL',
  testedSha,
  baseSha,
  headSha: process.env.HEAD_SHA || testedSha,
  mergeSha,
  runId,
  attempt: Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
  totalRequiredGates: required.length,
  evidenceRecords: records.length,
  passed: ledger.filter((record) => record.status === 'PASS').length,
  failed: ledger.filter((record) => record.status === 'FAIL').length,
  blocked: ledger.filter((record) => record.status === 'BLOCKED').length,
  missing,
  conflicts,
  shaMismatches,
  staleEvidenceCount: staleEvidence.length,
  missingEvidenceFields,
  foundationResult,
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
