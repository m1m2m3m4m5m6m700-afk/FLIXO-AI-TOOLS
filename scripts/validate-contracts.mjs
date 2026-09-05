import { CONTRACT_ID_LIST, CONTRACT_VERSIONS } from '../src/lib/contracts/ci-contracts.ts';

const failures = [];
const seen = new Set();

for (const id of CONTRACT_ID_LIST) {
  if (!/^G[1-4]-[A-Z0-9-]+-\d{3}$/u.test(id)) {
    failures.push(`invalid contract id format: ${id}`);
  }
  if (seen.has(id)) {
    failures.push(`duplicate contract id: ${id}`);
  }
  seen.add(id);

  if (CONTRACT_VERSIONS[id] !== 1) {
    failures.push(`invalid contract version for ${id}`);
  }
}

if (failures.length > 0) {
  console.error('Contract validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contract foundation valid: ${CONTRACT_ID_LIST.length} immutable contract IDs, version 1.`);
