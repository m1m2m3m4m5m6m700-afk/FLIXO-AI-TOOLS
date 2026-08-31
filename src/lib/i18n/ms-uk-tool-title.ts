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

const CATEGORY_FALLBACKS: Record<TargetLocale, Record<Category, string>> = {
  ms: { Images: 'Alat Imej', AI: 'Alat AI', Other: 'Alat' },
  uk: { Images: 'Інструмент зображень', AI: 'Інструмент ШІ', Other: 'Інструмент' },
};

function tokenize(value: string): string[] {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
}

export function localizeMsUkToolTitle(locale: Locale, title: string, category: Category): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  const translated = tokenize(title).map((part) => TERMS[part.toLowerCase()]?.[locale] ?? part).join(' ').trim();
  if (translated && translated.toLowerCase() !== title.trim().toLowerCase()) return translated;
  return `${CATEGORY_FALLBACKS[locale][category]}: ${title.trim()}`;
}
