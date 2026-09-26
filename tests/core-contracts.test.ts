import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.VITE_SITE_URL = process.env.VITE_SITE_URL || 'https://flixoai.vercel.app';

const { CANONICAL_LOCALES, DEFAULT_LOCALE, LOCALE_METADATA, normalizeLocale } =
  await import('../src/lib/i18n/config.ts');
const { getLocalizedToolPath, getLocalizedToolUrl } =
  await import('../src/lib/routing/route-resolver.ts');
const {
  assertSafeImageInput,
  IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
  IMAGE_COMPRESSOR_MAX_PIXELS,
} = await import('../src/tools/image-compressor/file-safety.ts');
const { solveMath, verifyMathReceipt } =
  await import('../src/lib/agent/universal/math-engine.ts');

test('i18n exposes the exact 20-locale production contract', () => {
  assert.deepEqual([...CANONICAL_LOCALES], [
    'ar','en','es','fr','de','hi','id','it','ja','ko',
    'ms','nl','pl','pt','ru','sv','th','tr','uk','vi',
  ]);
  assert.equal(DEFAULT_LOCALE, 'ar');
  assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
  assert.equal(LOCALE_METADATA.en.direction, 'ltr');
  assert.equal(normalizeLocale('ar-EG'), 'ar');
  assert.equal(normalizeLocale('unknown'), 'ar');
});

test('routing resolves every tool path from the locale contract', () => {
  const tool = { path: '/en/image-compressor' };
  assert.equal(getLocalizedToolPath(tool, 'ar'), '/ar/image-compressor');
  assert.equal(getLocalizedToolPath({ path: '/image-compressor' }, 'vi'), '/vi/image-compressor');
  assert.equal(getLocalizedToolUrl('https://flixoai.vercel.app', tool, 'de'), 'https://flixoai.vercel.app/de/image-compressor');
  assert.throws(() => getLocalizedToolPath({ path: '/en/image-compressor?x=1' }, 'en'), /query\/hash/);
});

test('image compressor safety protects size and pixel boundaries', () => {
  const file = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 };
  assert.doesNotThrow(() => assertSafeImageInput(file));
  assert.doesNotThrow(() => assertSafeImageInput(file, { width: 4000, height: 3000 }));
  assert.throws(() => assertSafeImageInput({ ...file, type: 'application/octet-stream' }), /Unsupported image format/);
  assert.throws(() => assertSafeImageInput({ ...file, size: IMAGE_COMPRESSOR_MAX_INPUT_SIZE + 1 }), /10 MB browser limit/);
  assert.throws(() => assertSafeImageInput(file, { width: 0, height: 3000 }), /invalid dimensions/);
  assert.throws(() => assertSafeImageInput(file, { width: 4001, height: 10000 }), /too large for safe browser processing/);
  assert.equal(IMAGE_COMPRESSOR_MAX_PIXELS, 40_000_000);
});

test('math engine uses a constrained arithmetic grammar', () => {
  assert.equal(solveMath({ expression: '2 + 3 * 4' }).value, 14);
  assert.equal(solveMath({ expression: '(2 + 3) * 4' }).value, 20);
  assert.equal(solveMath({ expression: '2 ^ 3 ^ 2' }).value, 512);
  assert.equal(solveMath({ expression: '10 / 4' }).value, 2.5);
  assert.equal(solveMath({ expression: '-5 + 2' }).value, -3);
  assert.throws(() => solveMath({ expression: '1 / 0' }), /MATH_DIVISION_BY_ZERO/);
  assert.throws(() => solveMath({ expression: 'Math.max(1, 2)' }), /MATH_EXPRESSION_UNSUPPORTED/);
  const receipt = solveMath({ expression: '6 * 7' });
  assert.equal(typeof receipt.timestamp, 'string');
  assert.equal(verifyMathReceipt(receipt), true);
  assert.equal(verifyMathReceipt({ ...receipt, value: 43 }), false);
});
