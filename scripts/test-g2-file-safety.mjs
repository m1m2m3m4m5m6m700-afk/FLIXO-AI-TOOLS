import assert from 'node:assert/strict';
import { detectZipBombRisk, validateArchiveEntries, validateFileSafety } from '../src/lib/contracts/file-safety.ts';
import { validateUploadBoundary } from '../src/lib/contracts/upload-boundary.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const json = new TextEncoder().encode('{"ok":true}');

const imagePolicy = {
  allowedMime: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif', 'image/svg+xml'],
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'],
  signatures: ['png'],
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
};

assert.equal(validateFileSafety({ name: 'input.png', mime: 'image/png', bytes: png.byteLength, content: png, width: 1, height: 1 }, imagePolicy).safe, true);
assert.equal(validateFileSafety({ name: '../input.png', mime: 'image/png', bytes: png.byteLength, content: png, width: 1, height: 1 }, imagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'input.pdf', mime: 'application/pdf', bytes: png.byteLength, content: png }, imagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'input.png', mime: 'image/png', bytes: png.byteLength + 1, content: png }, imagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'input.png', mime: 'image/png', bytes: png.byteLength, content: json }, imagePolicy).safe, false);

const jsonPolicy = {
  allowedMime: ['application/json'],
  allowedExtensions: ['json'],
  contentValidation: 'json',
  maxBytes: 2 * 1024 * 1024,
};
assert.equal(validateFileSafety({ name: 'ocr.json', mime: 'application/json', bytes: json.byteLength, content: json }, jsonPolicy).safe, true);
assert.equal(validateFileSafety({ name: 'ocr.json', mime: 'application/json', bytes: json.byteLength, content: new TextEncoder().encode('{bad') }, jsonPolicy).safe, false);

assert.equal(validateUploadBoundary({ name: 'input.png', size: png.byteLength, type: 'image/png' }, { maxBytes: 10 * 1024 * 1024, allowedMime: ['image/png'] }).allowed, true);
assert.equal(validateUploadBoundary({ name: 'input.pdf', size: png.byteLength, type: 'application/pdf' }, { maxBytes: 10 * 1024 * 1024, allowedMime: ['image/png'] }).allowed, false);

assert.equal(detectZipBombRisk(100, 1000, 40).isBomb, false);
assert.equal(detectZipBombRisk(1, 1000, 40).isBomb, true);
assert.equal(validateArchiveEntries([{ name: 'image.png', compressedBytes: 100, uncompressedBytes: 1000 }], { maxEntries: 10, maxUncompressedBytes: 20_000, maxDepth: 2, maxCompressionRatio: 40 }).safe, true);
assert.equal(validateArchiveEntries([{ name: '../image.png', compressedBytes: 100, uncompressedBytes: 100 }], { maxEntries: 10, maxUncompressedBytes: 20_000, maxDepth: 2, maxCompressionRatio: 40 }).safe, false);

console.log('G2 image-product file safety contract passed.');
