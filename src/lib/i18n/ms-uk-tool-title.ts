import type { Locale } from './config';

type Category = 'Images' | 'AI' | 'Other';

type TargetLocale = 'ms' | 'uk';

const TERMS: Record<string, Partial<Record<TargetLocale, string>>> = {
  image: { ms: 'Imej', uk: 'Зображення' },
  images: { ms: 'Imej', uk: 'Зображення' },
  photo: { ms: 'Foto', uk: 'Фото' },
  object: { ms: 'Objek', uk: 'Об’єкт' },
  remove: { ms: 'Buang', uk: 'Видалення' },
  remover: { ms: 'Penyingkir', uk: 'Засіб видалення' },
  background: { ms: 'Latar belakang', uk: 'Фон' },
  compressor: { ms: 'Pemampat', uk: 'Компресор' },
  converter: { ms: 'Penukar', uk: 'Конвертер' },
  convert: { ms: 'Tukar', uk: 'Конвертувати' },
  cutter: { ms: 'Pemotong', uk: 'Обрізувач' },
  trimmer: { ms: 'Perapi', uk: 'Обрізувач' },
  generator: { ms: 'Penjana', uk: 'Генератор' },
  maker: { ms: 'Pembuat', uk: 'Створювач' },
  optimizer: { ms: 'Pengoptimum', uk: 'Оптимізатор' },
  upscaler: { ms: 'Peningkat', uk: 'Збільшувач' },
  watermark: { ms: 'Tanda air', uk: 'Водяний знак' },
  blur: { ms: 'Kabur', uk: 'Розмиття' },
  audio: { ms: 'Audio', uk: 'Аудіо' },
  video: { ms: 'Video', uk: 'Відео' },
  text: { ms: 'Teks', uk: 'Текст' },
  pdf: { ms: 'PDF', uk: 'PDF' },
  ocr: { ms: 'OCR', uk: 'OCR' },
  svg: { ms: 'SVG', uk: 'SVG' },
  ai: { ms: 'AI', uk: 'ШІ' },
  online: { ms: 'dalam talian', uk: 'онлайн' },
};

function tokenize(value: string): string[] {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Resolve only genuinely localized ms/uk tool titles.
 * Returning undefined is intentional: callers must fail closed rather than exposing an English title.
 */
export function localizeMsUkToolTitle(locale: Locale, title: string, _category: Category): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  const translated = tokenize(title).map((part) => TERMS[part.toLowerCase()]?.[locale] ?? part).join(' ').trim();
  if (!translated || translated.toLowerCase() === title.trim().toLowerCase()) return undefined;
  return translated;
}
