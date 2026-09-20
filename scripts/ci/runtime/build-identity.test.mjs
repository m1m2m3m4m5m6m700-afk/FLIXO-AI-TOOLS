import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const identity = JSON.parse(await readFile('artifacts/ci/build/identity.json', 'utf8'));
assert.equal(identity.schemaVersion, 1);
assert.ok(identity.commitSha);
assert.equal(identity.lockfileHash.length, 64);
assert.equal(identity.artifactHash.length, 64);
assert.ok(Array.isArray(identity.files));
console.log(`Build identity PASS: files=${identity.files.length} artifactHash=${identity.artifactHash}`);
