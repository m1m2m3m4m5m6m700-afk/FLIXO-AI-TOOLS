import assert from 'node:assert/strict';
import { validateSvgOutput } from '../src/tools/image-to-svg/output-integrity.ts';

const validText = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
const validBlob = new Blob([validText], { type: 'image/svg+xml' });
const valid = validateSvgOutput(validBlob, validText);
assert.equal(valid.valid, true);
assert.deepEqual(valid.failures, []);

const badRoot = validateSvgOutput(new Blob(['hello'], { type: 'image/svg+xml' }), 'hello');
assert.equal(badRoot.valid, false);
assert.ok(badRoot.failures.includes('missing SVG root element'));

const badMime = validateSvgOutput(new Blob([validText], { type: 'text/plain' }), validText);
assert.equal(badMime.valid, false);
assert.ok(badMime.failures.some((failure) => failure.includes('MIME')));

const badNamespace = validateSvgOutput(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }), '<svg></svg>');
assert.equal(badNamespace.valid, false);
assert.ok(badNamespace.failures.includes('missing SVG namespace'));

console.log('FLIXO SVG integrity tests: PASS');
