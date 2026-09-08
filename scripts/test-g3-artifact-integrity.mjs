import assert from 'node:assert/strict';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity.ts';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00);
const SVG = text('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
const JSON = text('{"ok":true}');
const TXT = text('OCR result');

const assertValid = (result) => assert.equal(result.valid, true, result.failures.join('; '));
const assertInvalid = (result) => assert.equal(result.valid, false);

const imageSpec = {
  toolId: 'g3-image',
  allowedMime: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'],
  maxBytes: 25 * 1024 * 1024,
  minBytes: 1,
  maxPixels: 40_000_000,
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
  signatures: ['89504e470d0a1a0a'],
  requireArtifact: true,
  requireSafeFilename: true,
};

assertValid(validateOutputIntegrity(PNG.byteLength, 'image/png', imageSpec, { width: 1, height: 1 }, { filename: 'result.png', bytes: PNG }));
assertInvalid(validateOutputIntegrity(PNG.byteLength, 'application/octet-stream', imageSpec, { width: 1, height: 1 }, { filename: 'result.png', bytes: PNG }));
assertInvalid(validateOutputIntegrity(PNG.byteLength, 'image/png', imageSpec, { width: 1, height: 1 }, { filename: 'result.txt', bytes: PNG }));
assertInvalid(validateOutputIntegrity(PNG.byteLength, 'image/png', imageSpec, { width: 7000, height: 7000 }, { filename: 'result.png', bytes: PNG }));

const svgSpec = {
  toolId: 'g3-svg',
  allowedMime: ['image/svg+xml'],
  maxBytes: 5 * 1024 * 1024,
  allowedExtensions: ['svg'],
  requireArtifact: true,
  requireSafeFilename: true,
  parseAs: 'utf8',
};
assertValid(validateOutputIntegrity(SVG.byteLength, 'image/svg+xml', svgSpec, undefined, { filename: 'result.svg', bytes: SVG }));

const textSpec = {
  toolId: 'g3-text',
  allowedMime: ['text/plain'],
  maxBytes: 2 * 1024 * 1024,
  allowedExtensions: ['txt'],
  requireArtifact: true,
  requireSafeFilename: true,
  parseAs: 'utf8',
};
assertValid(validateOutputIntegrity(TXT.byteLength, 'text/plain', textSpec, undefined, { filename: 'ocr.txt', bytes: TXT }));

const jsonSpec = {
  toolId: 'g3-json',
  allowedMime: ['application/json'],
  maxBytes: 2 * 1024 * 1024,
  allowedExtensions: ['json'],
  requireArtifact: true,
  requireSafeFilename: true,
  parseAs: 'json',
};
assertValid(validateOutputIntegrity(JSON.byteLength, 'application/json', jsonSpec, undefined, { filename: 'ocr.json', bytes: JSON }));
assertInvalid(validateOutputIntegrity(JSON.byteLength, 'application/json', jsonSpec, undefined, { filename: 'ocr.json', bytes: text('{"ok":}') }));

const zipSpec = {
  toolId: 'g3-image-batch-package',
  allowedMime: ['application/zip'],
  maxBytes: 100 * 1024 * 1024,
  allowedExtensions: ['zip'],
  signatures: [{ hex: '504b0304' }],
  requireArtifact: true,
  requireSafeFilename: true,
};
assertValid(validateOutputIntegrity(ZIP.byteLength, 'application/zip', zipSpec, undefined, { filename: 'images.zip', bytes: ZIP }));

console.log('G3 image-product artifact integrity contract passed.');
