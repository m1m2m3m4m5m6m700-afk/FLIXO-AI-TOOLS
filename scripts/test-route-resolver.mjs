import assert from 'node:assert/strict';
import { getLocalizedToolPath, getLocalizedToolUrl } from '../src/lib/routing/route-resolver.ts';

const tool = { path: '/en/image-compressor' };

assert.equal(getLocalizedToolPath(tool, 'en'), '/en/image-compressor');
assert.equal(getLocalizedToolPath(tool, 'ar'), '/ar/image-compressor');
assert.equal(
  getLocalizedToolUrl('https://canonical.test', tool, 'ar'),
  'https://canonical.test/ar/image-compressor',
);
assert.throws(
  () => getLocalizedToolPath({ path: '/image-compressor' }, 'en'),
  /Invalid canonical tool path/,
);
assert.throws(
  () => getLocalizedToolPath({ path: '/en/image-compressor?x=1' }, 'en'),
  /query/hash/,
);

console.log('route resolver contract tests passed.');
