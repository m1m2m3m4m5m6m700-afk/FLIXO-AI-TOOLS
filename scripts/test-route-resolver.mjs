import assert from 'node:assert/strict';
import { getToolPath, getLocalizedToolUrl } from '../src/lib/routing/route-resolver.ts';

const tool = { path: '/en/image-compressor' };

assert.equal(getToolPath(tool, 'en'), '/en/image-compressor');
assert.equal(getToolPath(tool, 'ar'), '/ar/image-compressor');
assert.equal(
  getLocalizedToolUrl('https://canonical.test', tool, 'ar'),
  'https://canonical.test/ar/image-compressor',
);
assert.throws(
  () => getToolPath({ path: '/image-compressor' }, 'en'),
  /Invalid canonical tool path/,
);
assert.throws(
  () => getToolPath({ path: '/en/image-compressor?x=1' }, 'en'),
  /query\/hash/,
);

console.log('route resolver contract tests passed.');
