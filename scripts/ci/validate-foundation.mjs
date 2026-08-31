import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CI_CONTRACTS } from './contracts/registry.ts';

const ids = new Set();
for (const contract of CI_CONTRACTS) {
  if (ids.has(contract.id)) throw new Error(`Duplicate CI contract: ${contract.id}`);
  ids.add(contract.id);
  for (const dependency of contract.dependencies) {
    if (!ids.has(dependency) && dependency !== '') {
      // Forward references are permitted; graph-cycle validation belongs to CI-3.
      if (CI_CONTRACTS.every((candidate) => candidate.id !== dependency)) {
        throw new Error(`Unknown CI contract dependency: ${contract.id} -> ${dependency}`);
      }
    }
  }
}

const canonical = JSON.stringify(CI_CONTRACTS, Object.keys(CI_CONTRACTS).sort());
const hash = createHash('sha256').update(canonical).digest('hex');
readFileSync('package-lock.json');
console.log(`CI foundation PASS: contracts=${CI_CONTRACTS.length} ciConfigHash=${hash}`);
