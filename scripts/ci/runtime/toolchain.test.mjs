import assert from 'node:assert/strict';
import { readToolchainIdentity } from './toolchain.ts';

const first = readToolchainIdentity();
const second = readToolchainIdentity();
assert.equal(first.fingerprint, second.fingerprint);
assert.equal(first.lockfileHash.length, 64);
assert.equal(first.fingerprint.length, 64);
assert.ok(first.nvmrc.length > 0);
assert.match(first.node, /^v\d+\./);

console.log(`CI toolchain PASS: Node=${first.node} npm=${first.npm} nvmrc=${first.nvmrc} fingerprint=${first.fingerprint}`);
