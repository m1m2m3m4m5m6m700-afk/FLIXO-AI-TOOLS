import { describe, expect, it } from 'vitest';
import { localizeMsUkToolTitle } from '@/lib/i18n/ms-uk-tool-title';

describe('ms/uk tool title localization', () => {
  it('localizes image object remover in Malay', () => {
    expect(localizeMsUkToolTitle('ms', 'Object Remover', 'Images')).toBe('Objek Penyingkir');
  });

  it('localizes image object remover in Ukrainian', () => {
    expect(localizeMsUkToolTitle('uk', 'Object Remover', 'Images')).toBe('Об’єкт Засіб видалення');
  });

  it('does not claim localization for unsupported locales', () => {
    expect(localizeMsUkToolTitle('ar', 'Object Remover', 'Images')).toBeUndefined();
  });
});
