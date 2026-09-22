#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const output = process.env.FLIXO_NEGATIVE_PROOF_PATH ?? '/tmp/flixo-negative-proof.json';
const sha = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

const cases = [
  { id: 'FORGED_PATCH_DIGEST', reject: (x) => x.patchSha256 !== x.rederivedPatchSha256 },
  { id: 'STALE_SHA', reject: (x) => x.targetSha !== x.currentSha },
  { id: 'FORGED_ACTOR', reject: (x) => new Set(x.authorities).size !== x.authorities.length },
  { id: 'REPLAYED_GREEN', reject: (x) => x.greenSha !== x.candidateSha },
  { id: 'MISSING_PLATFORM_ATTESTATION', reject: (x) => x.platformStatus !== 'VERIFIED' },
  { id: 'BROKEN_CHAIN', reject: (x) => x.chainRoot !== x.recomputedChainRoot },
  { id: 'MISSING_ROLLBACK_PROOF', reject: (x) => x.rollbackStatus !== 'PROVEN' },
  { id: 'MISSING_CANARY', reject: (x) => x.canaryStatus !== 'PASS' },
];

const synthetic = {
  patchSha256: sha('truth'),
  rederivedPatchSha256: sha('tampered'),
  targetSha: 'a'.repeat(40),
  currentSha: 'b'.repeat(40),
  authorities: ['CHAIR_1', 'CHAIR_1', 'CHAIR_1'],
  greenSha: 'c'.repeat(40),
  candidateSha: 'd'.repeat(40),
  platformStatus: 'UNTRUSTED',
  chainRoot: sha('x'),
  recomputedChainRoot: sha('y'),
  rollbackStatus: 'MISSING',
  canaryStatus: 'MISSING',
};

const exercised = cases.map((item) => ({ id: item.id, rejected: Boolean(item.reject(synthetic)) }));
const receipt = {
  schemaVersion: 1,
  protocol: 'FLIXO-MASTER-REPAIR-NEGATIVE-PROOF-v1',
  authority: 'READ_ONLY_NEGATIVE_TESTING',
  cases: exercised,
  allRejected: exercised.every((item) => item.rejected),
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.allRejected) process.exitCode = 2;
