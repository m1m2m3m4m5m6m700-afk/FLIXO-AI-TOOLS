import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/lib/contracts/file-safety.ts');
const source = fs.readFileSync(file, 'utf8');

for (const token of ['FileSafetyInput', 'FileSafetyPolicy', 'FileSafetyResult', 'validateFileSafety']) {
  assert.ok(source.includes(token), `missing safety contract token: ${token}`);
}

assert.ok(source.includes('maxBytes'));
assert.ok(source.includes('allowedMime'));
assert.ok(source.includes('maxPixels'));
assert.ok(source.includes('signatures'));
assert.ok(source.includes('file size must be a positive integer'));
assert.ok(source.includes('unsupported input MIME type'));
assert.ok(source.includes('input exceeds the maximum pixel count'));
assert.ok(source.includes('input signature does not match the allowed file signatures'));

console.log('file safety contract source checks passed');
