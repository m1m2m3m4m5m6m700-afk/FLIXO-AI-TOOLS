import { CONTRACT_DEFINITIONS } from '../src/ci/contracts/definitions.ts';
import { CONTRACT_IDS } from '../src/ci/contracts/ids.ts';
import { CONTRACT_STATUSES, assertContractResult } from '../src/ci/contracts/foundation.ts';

const ids = Object.values(CONTRACT_IDS);
if (new Set(ids).size !== ids.length) throw new Error('Contract IDs are not unique');
if (CONTRACT_DEFINITIONS.some((definition) => !ids.includes(definition.id))) {
  throw new Error('Contract definition contains an unknown ID');
}
if (new Set(CONTRACT_DEFINITIONS.map((definition) => definition.id)).size !== CONTRACT_DEFINITIONS.length) {
  throw new Error('Contract definitions are not unique');
}
if (CONTRACT_STATUSES.join(',') !== 'PASS,FAIL,BLOCKED,NOT_APPLICABLE') {
  throw new Error('Contract status vocabulary drift');
}

assertContractResult({ gate: 'G1', contract: CONTRACT_IDS.G1_REGISTRY, status: 'PASS', scope: {} });
let rejected = false;
try {
  assertContractResult({ gate: 'G1', contract: CONTRACT_IDS.G1_REGISTRY, status: 'GREEN', scope: {} });
} catch {
  rejected = true;
}
if (!rejected) throw new Error('Invalid contract status was accepted');

console.log(`CI foundation PASS: ${ids.length} immutable IDs, ${CONTRACT_DEFINITIONS.length} definitions`);
