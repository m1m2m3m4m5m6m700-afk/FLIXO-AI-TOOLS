import assert from 'node:assert/strict';
import { assertCandidateCannotPromote, inspectCapabilityGap } from '../src/lib/agent/capability-builder.ts';

const existing = inspectCapabilityGap('image-compressor');
assert.equal(existing.state, 'EXISTING');
assert.equal(existing.matchedCapabilityId, 'image-compressor');

const composable = inspectCapabilityGap('product_background');
assert.equal(composable.state, 'COMPOSABLE');
assert.ok(composable.composableWith.includes('background-remover'));

const extendable = inspectCapabilityGap('object_removal');
assert.equal(extendable.state, 'EXTENDABLE');
assert.equal(extendable.extendableFrom, 'object-remover');
assert.ok(extendable.candidate);
assert.equal(extendable.candidate?.productionMutationAllowed, false);

const missing = inspectCapabilityGap('semantic_inpainting');
assert.equal(missing.state, 'MISSING');
assert.equal(missing.candidate?.lifecycle, 'CONTRACT_VALIDATED');
assert.equal(missing.candidate?.verifier, 'INDEPENDENT_VERIFIER_REQUIRED');
assert.equal(missing.candidate?.productionMutationAllowed, false);
assertCandidateCannotPromote(missing.candidate!);

assert.throws(() => inspectCapabilityGap('   '), /requestedCapability is required/);

console.log('Capability Builder v1 contract tests passed.');
