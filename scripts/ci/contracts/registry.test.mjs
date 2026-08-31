import assert from 'node:assert/strict';
import { CI_CONTRACTS, getCiContract } from './registry.ts';

assert.ok(CI_CONTRACTS.length > 0);
assert.equal(new Set(CI_CONTRACTS.map((contract) => contract.id)).size, CI_CONTRACTS.length);

for (const contract of CI_CONTRACTS) {
  assert.ok(getCiContract(contract.id));
  assert.equal(contract.id, getCiContract(contract.id)?.id);
  assert.ok(contract.version >= 1);
  for (const dependency of contract.dependencies) assert.ok(getCiContract(dependency));
}

console.log(`CI registry self-test PASS: ${CI_CONTRACTS.length} contracts`);
