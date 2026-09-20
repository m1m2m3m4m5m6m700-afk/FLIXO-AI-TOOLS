import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CI_CONTRACTS } from './contracts/registry.ts';

const ids = new Set();
for (const contract of CI_CONTRACTS) {
  if (ids.has(contract.id)) throw new Error(`Duplicate CI contract: ${contract.id}`);
  ids.add(contract.id);
  for (const dependency of contract.dependencies) {
    if (!CI_CONTRACTS.some((candidate) => candidate.id === dependency)) {
      throw new Error(`Unknown CI contract dependency: ${contract.id} -> ${dependency}`);
    }
  }
}

const canonical = JSON.stringify([...CI_CONTRACTS].sort((a, b) => a.id.localeCompare(b.id)));
const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
readFileSync('package-lock.json');
console.log(`CI foundation PASS: contracts=${CI_CONTRACTS.length} ciConfigHash=${hash}`);
