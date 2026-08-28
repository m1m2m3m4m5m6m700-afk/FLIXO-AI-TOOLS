import { describe, expect, it } from 'vitest';
import { getLocalizedToolPath, getLocalizedToolUrl } from './route-resolver';

describe('localized tool route resolver', () => {
  const tool = { path: '/en/image-compressor' } as const;

  it('localizes the canonical manifest path', () => {
    expect(getLocalizedToolPath(tool, 'en')).toBe('/en/image-compressor');
    expect(getLocalizedToolPath(tool, 'ar')).toBe('/ar/image-compressor');
  });

  it('builds an absolute localized URL', () => {
    expect(getLocalizedToolUrl('https://canonical.test', tool, 'ar')).toBe('https://canonical.test/ar/image-compressor');
  });

  it('rejects non-English canonical paths', () => {
    expect(() => getLocalizedToolPath({ path: '/image-compressor' }, 'en')).toThrow(/Invalid canonical tool path/u);
  });
});
