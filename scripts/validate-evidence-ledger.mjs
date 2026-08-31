import { readFile } from 'node:fs/promises';
import { CONTRACT_ID_LIST, CONTRACT_IDS, CONTRACT_VERSIONS } from '../src/lib/contracts/ci-contracts.ts';

const schema = JSON.parse(await readFile(new URL('../src/lib/contracts/evidence-ledger.schema.json', import.meta.url), 'utf8'));
if (schema.$id !== 'https://flixo.ai/schemas/contract-evidence-v1.json') throw new Error('Evidence schema id mismatch');
if (schema.properties?.schemaVersion?.const !== 1) throw new Error('Evidence schema version mismatch');

const required = new Set(schema.required ?? []);
for (const field of ['schemaVersion', 'gate', 'contract', 'status', 'scope', 'recordedAt', 'commit', 'contractVersion']) {
  if (!required.has(field)) throw new Error(`Evidence schema missing required field: ${field}`);
}

if (schema.properties?.status?.enum?.join(',') !== 'PASS,FAIL,BLOCKED,NOT_APPLICABLE') {
  throw new Error('Evidence status contract mismatch');
}
if (schema.properties?.commit?.pattern !== '^[0-9a-f]{40}$') {
  throw new Error('Evidence commit identity contract mismatch');
}
if (schema.additionalProperties !== false) throw new Error('Evidence schema must reject unknown fields');
if (CONTRACT_ID_LIST.length !== 42) throw new Error(`Unexpected contract ID count: ${CONTRACT_ID_LIST.length}`);

const gateByPrefix = { G1: 'G1', G2: 'G2', G3: 'G3', G4: 'G4' };
for (const id of CONTRACT_ID_LIST) {
  if (!/^(G[1-4]-[A-Z0-9-]+-\d{3})$/.test(id)) throw new Error(`Invalid Contract ID: ${id}`);
  if (CONTRACT_VERSIONS[id] !== 1) throw new Error(`Invalid contract version: ${id}`);
  const gate = gateByPrefix[id.slice(0, 2)];
  if (!gate || id.slice(0, 2) !== gate) throw new Error(`Contract/gate identity mismatch: ${id}`);
}

if (Object.keys(CONTRACT_IDS).length !== CONTRACT_ID_LIST.length) {
  throw new Error('Contract ID registry/list mismatch');
}

console.log(`Evidence ledger schema PASS (${CONTRACT_ID_LIST.length} contract IDs)`);
