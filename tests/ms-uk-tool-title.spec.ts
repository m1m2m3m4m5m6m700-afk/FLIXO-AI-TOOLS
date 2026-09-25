import { describe, expect, it } from 'vitest';
import { getReadyToolConfigs } from '@/config/tools';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { ms } from '@/lib/i18n/locales/ms';
import { uk } from '@/lib/i18n/locales/uk';
import { localizeMsUkToolTitle } from '@/lib/i18n/ms-uk-tool-title';

describe('ms/uk tool title localization', () => {
  it('localizes image object remover in Malay', () => {
    expect(localizeMsUkToolTitle('ms', 'Object Remover', 'Images')).toBe('Objek Penyingkir');
  });

  it('localizes image object remover in Ukrainian', () => {
    expect(localizeMsUkToolTitle('uk', 'Object Remover', 'Images')).toBe('Об’єкт Засіб видалення');
  });

  it('keeps canonical locale identity in the repaired dictionaries', () => {
    expect(ms.locale).toBe('ms');
    expect(ms.languageTag).toBe('ms');
    expect(uk.locale).toBe('uk');
    expect(uk.languageTag).toBe('uk');
  });

  it('has an authoritative reviewed SEO name for every ready tool in ms and uk', () => {
    for (const tool of getReadyToolConfigs()) {
      expect(getAuthoritativeToolSeoName(tool, 'ms'), `Missing ms SEO name for ${tool.id}`).toBeTruthy();
      expect(getAuthoritativeToolSeoName(tool, 'uk'), `Missing uk SEO name for ${tool.id}`).toBeTruthy();
    }
  });

  it('does not claim localization for unsupported locales', () => {
    expect(localizeMsUkToolTitle('ar', 'Object Remover', 'Images')).toBeUndefined();
  });
});
