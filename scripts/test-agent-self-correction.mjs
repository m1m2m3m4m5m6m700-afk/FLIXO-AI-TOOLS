import assert from 'node:assert/strict';
import { getCapability } from '../src/lib/agent/capability-registry.ts';

const compressor = getCapability('image-compressor');
const converter = getCapability('image-converter');
assert.ok(compressor);
assert.ok(converter);

const input = new Blob(['input'], { type: 'image/png' });
const acceptable = new Blob(['x'.repeat(100 * 1024)], { type: 'image/webp' });
const oversized = new Blob(['x'.repeat(300 * 1024)], { type: 'image/webp' });
const webp = new Blob(['output'], { type: 'image/webp' });
const png = new Blob(['output'], { type: 'image/png' });

assert.equal(await compressor.verifier(input, acceptable, { targetSizeKB: 200 }), true);
assert.equal(await compressor.verifier(input, oversized, { targetSizeKB: 200 }), false);
assert.equal(await converter.verifier(input, webp, { format: 'image/webp' }), true);
assert.equal(await converter.verifier(input, png, { format: 'image/webp' }), false);

console.log('Agent self-correction verifier contract tests passed.');
