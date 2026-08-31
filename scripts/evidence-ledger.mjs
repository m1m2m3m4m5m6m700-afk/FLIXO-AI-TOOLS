import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CONTRACT_ID_LIST, CONTRACT_VERSIONS } from '../src/lib/contracts/ci-contracts.ts';
import { EVIDENCE_SCHEMA_VERSION, createEvidenceRecord, serializeEvidence } from '../src/lib/contracts/evidence-ledger.ts';

export const EVIDENCE_ROOT = 'artifacts/contracts';

export function assertKnownContract(contract) {
  if (!CONTRACT_ID_LIST.includes(contract)) throw new Error(`Unknown contract ID: ${contract}`);
}

export function buildEvidenceRecord(result, metadata) {
  assertKnownContract(result.contract);
  const expectedVersion = CONTRACT_VERSIONS[result.contract];
  if (String(expectedVersion) !== String(metadata.contractVersion)) {
    throw new Error(`Contract version mismatch: ${result.contract}`);
  }
  return createEvidenceRecord(result, metadata);
}

export function evidencePath(root, record) {
  const scope = [record.scope.locale, record.scope.toolId, record.scope.route, record.scope.file]
    .filter(Boolean)
    .join('__')
    .replaceAll('/', '_') || 'global';
  return join(root, record.gate.toLowerCase(), `${record.contract}__${scope}.json`);
}

export async function writeEvidence(record, root = EVIDENCE_ROOT) {
  const payload = serializeEvidence(record);
  const target = evidencePath(root, record);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, payload, 'utf8');
  await rename(temporary, target);
  return target;
}

export async function readEvidence(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export { EVIDENCE_SCHEMA_VERSION };
