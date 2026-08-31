import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { CI_CONTRACTS } from './registry.ts';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

const contracts = [...CI_CONTRACTS]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(canonicalize);

const snapshot = {
  schemaVersion: 1,
  contracts,
  contractIds: contracts.map((contract) => contract.id),
};

const serialized = JSON.stringify(canonicalize(snapshot), null, 2) + '\n';
const contractHash = createHash('sha256').update(serialized, 'utf8').digest('hex');
const output = { ...snapshot, contractHash };

await mkdir('artifacts/ci/contracts', { recursive: true });
await writeFile('artifacts/ci/contracts/snapshot.json', JSON.stringify(output, null, 2) + '\n');
await writeFile('artifacts/ci/contracts/contract-hash.txt', `${contractHash}\n`);
console.log(`Contract snapshot PASS: ${contracts.length} contracts, hash=${contractHash}`);
