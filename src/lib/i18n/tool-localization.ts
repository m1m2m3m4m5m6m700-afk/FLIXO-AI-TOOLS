import type { Locale } from './config';
import { buildLocalizedToolSeo } from '../seo/tool-catalog';

export const CATEGORY_LABELS: Record<Locale, { Images: string }> = {
  ar: { Images: 'الصور' },
  en: { Images: 'Images' },
  es: { Images: 'Imágenes' },
  fr: { Images: 'Images' },
  de: { Images: 'Bilder' },
  hi: { Images: 'छवियाँ' },
  id: { Images: 'Gambar' },
  it: { Images: 'Immagini' },
  ja: { Images: '画像' },
  ko: { Images: '이미지' },
  ms: { Images: 'Imej' },
  nl: { Images: 'Afbeeldingen' },
  pl: { Images: 'Obrazy' },
  pt: { Images: 'Imagens' },
  ru: { Images: 'Изображения' },
  sv: { Images: 'Bilder' },
  th: { Images: 'รูปภาพ' },
  tr: { Images: 'Görseller' },
  uk: { Images: 'Зображення' },
  vi: { Images: 'Hình ảnh' },
};

function canonicalSeo(locale: Locale, title: string) {
  return buildLocalizedToolSeo({ id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, path: '', description: title, category: 'Images', isReady: true }, locale);
}

export function localizeToolCategory(locale: Locale, category: 'Images'): string {
  return CATEGORY_LABELS[locale][category];
}

export function localizeToolTitle(locale: Locale, title: string, category: 'Images'): string {
  if (locale === 'en') return title;
  const localized = canonicalSeo(locale, title).title.replace(/\s+\|\s+FLIXO$/u, '').trim();
  return localized || `${CATEGORY_LABELS[locale][category]}`;
}

export function localizeToolDescription(locale: Locale, title: string, category: 'Images'): string {
  if (locale === 'en') return `Use ${title} in FLIXO directly in your browser.`;
  const localizedTitle = localizeToolTitle(locale, title, category);
  return `${localizedTitle} — ${canonicalSeo(locale, title).description}`;
}
