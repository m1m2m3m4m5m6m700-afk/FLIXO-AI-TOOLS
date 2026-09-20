import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONTRACT_ID_LIST, CONTRACT_VERSIONS } from '../src/lib/contracts/ci-contracts.ts';
import { EVIDENCE_SCHEMA_VERSION } from '../src/lib/contracts/evidence-ledger.ts';

const root = process.env.EVIDENCE_OUTPUT_ROOT ?? 'artifacts/contracts';
const expectedCommit = process.env.EVIDENCE_COMMIT;
if (!expectedCommit || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
  throw new Error('EVIDENCE_COMMIT must be a 40-character lowercase SHA');
}

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files;
}

const files = await collect(root);
if (files.length === 0) throw new Error(`No generated evidence found under ${root}`);

for (const file of files) {
  const record = JSON.parse(await readFile(file, 'utf8'));
  if (record.schemaVersion !== EVIDENCE_SCHEMA_VERSION) throw new Error(`${file}: schemaVersion mismatch`);
  if (!CONTRACT_ID_LIST.includes(record.contract)) throw new Error(`${file}: unknown contract ${record.contract}`);
  if (record.contractVersion !== String(CONTRACT_VERSIONS[record.contract])) {
    throw new Error(`${file}: contract version mismatch`);
  }
  if (record.commit !== expectedCommit) throw new Error(`${file}: commit SHA mismatch`);
  if (!['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'].includes(record.status)) {
    throw new Error(`${file}: invalid status`);
  }
  if (!record.gate || !record.scope || !record.recordedAt) throw new Error(`${file}: missing required evidence data`);
}

console.log(`Generated evidence PASS: ${files.length} record(s), SHA ${expectedCommit}`);
