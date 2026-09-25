import assert from 'node:assert/strict';
import { DEVELOPER_CAPABILITIES, assertDeveloperMutationAllowed, getDeveloperCapability } from '../src/lib/developer/developer-tool-registry.ts';

const ids = DEVELOPER_CAPABILITIES.map((c) => c.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(DEVELOPER_CAPABILITIES.length >= 18);
assert.equal(getDeveloperCapability('developer.code.typescript')?.state, 'AVAILABLE');
assert.equal(getDeveloperCapability('developer.repair.targeted')?.executionMode, 'MUTATING');
assert.equal(getDeveloperCapability('developer.repair.targeted')?.mutationRequiresCanonicalGreen, true);
assert.throws(() => assertDeveloperMutationAllowed('developer.code.typescript'), /NOT_MUTATING/);
assert.doesNotThrow(() => assertDeveloperMutationAllowed('developer.repair.targeted'));
assert.throws(() => assertDeveloperMutationAllowed('unknown'), /UNKNOWN/);
console.log('developer-tool-registry: PASS');
