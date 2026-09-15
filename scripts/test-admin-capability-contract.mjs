import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  ADMIN_CAPABILITIES,
  ADMIN_LOCKED_MUTATION_CAPABILITIES,
  INITIAL_CONTROL_PLANE_STATE,
} from '../src/lib/admin/control-plane.ts';

const unique = new Set(ADMIN_CAPABILITIES);
assert.equal(unique.size, ADMIN_CAPABILITIES.length);

for (const capability of ADMIN_CAPABILITIES) {
  assert.equal(
    ADMIN_LOCKED_MUTATION_CAPABILITIES.includes(capability),
    false,
    `active foundation capability must not also be locked: ${capability}`,
  );
}

for (const capability of ADMIN_LOCKED_MUTATION_CAPABILITIES) {
  assert.equal(
    ADMIN_CAPABILITIES.includes(capability),
    false,
    `locked mutation capability must not be exposed as active: ${capability}`,
  );
}

assert.equal(INITIAL_CONTROL_PLANE_STATE.connected, false);
assert.equal(INITIAL_CONTROL_PLANE_STATE.verdict, 'UNAVAILABLE');
assert.equal(INITIAL_CONTROL_PLANE_STATE.reason, 'server_auth_boundary_not_connected');
assert.deepEqual(INITIAL_CONTROL_PLANE_STATE.capabilities, ADMIN_CAPABILITIES);
assert.deepEqual(INITIAL_CONTROL_PLANE_STATE.evidence, []);

assert.equal(ADMIN_LOCKED_MUTATION_CAPABILITIES.includes('production.write'), true);
assert.equal(ADMIN_CAPABILITIES.includes('production.write'), false);

const errorMemory = spawnSync(
  process.execPath,
  ['--experimental-strip-types', 'scripts/test-admin-error-memory.mjs'],
  { stdio: 'inherit' },
);
assert.equal(errorMemory.status, 0, 'ADMIN error memory contract must pass inside the canonical admin test chain');

console.log('Admin capability catalog invariants: PASS');
console.log('Admin error memory contract: PASS (canonical unit chain)');
