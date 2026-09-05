import assert from 'node:assert/strict';
import { assertSafeImageInput, IMAGE_COMPRESSOR_MAX_INPUT_SIZE, IMAGE_COMPRESSOR_MAX_PIXELS } from '../src/tools/image-compressor/file-safety.ts';

const validFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 };

assert.doesNotThrow(() => assertSafeImageInput(validFile));
assert.doesNotThrow(() => assertSafeImageInput(validFile, { width: 4000, height: 3000 }));

assert.throws(
  () => assertSafeImageInput({ ...validFile, type: 'application/octet-stream' }),
  /Unsupported image format/,
);
assert.throws(
  () => assertSafeImageInput({ ...validFile, size: IMAGE_COMPRESSOR_MAX_INPUT_SIZE + 1 }),
  /10 MB browser limit/,
);
assert.throws(
  () => assertSafeImageInput(validFile, { width: 0, height: 3000 }),
  /invalid dimensions/,
);
assert.throws(
  () => assertSafeImageInput(validFile, { width: IMAGE_COMPRESSOR_MAX_PIXELS, height: 2 }),
  /too large for safe browser processing/,
);

console.log('PASS: image compressor shared File Safety boundary');
