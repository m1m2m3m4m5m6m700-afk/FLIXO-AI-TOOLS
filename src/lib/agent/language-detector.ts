import { LOCALES, type Locale } from '@/lib/i18n';

const SCRIPT_RULES: readonly [Locale, RegExp][] = [
  ['ar', /[\u0600-\u06FF]/],
  ['hi', /[\u0900-\u097F]/],
  ['th', /[\u0E00-\u0E7F]/],
  ['ja', /[\u3040-\u30FF]/],
  ['ko', /[\uAC00-\uD7AF]/],
];

const LANGUAGE_SIGNATURES: readonly [Locale, RegExp][] = [
  ['fr', /\b(?:compresser|redimensionner|supprimer|exécuter)\b/i],
  ['es', /\b(?:comprimir|convertirla|cambiar|quitar|ejecutar)\b/i],
  ['de', /\b(?:komprimieren|konvertieren|skalieren|entfernen|ausführen|umwandeln)\b/i],
  ['it', /\b(?:comprimere|convertire|ridimensionare|rimuovere|eseguire)\b/i],
  ['pt', /\b(?:comprimir|converter|redimensionar|remover|executar)\b/i],
  ['nl', /\b(?:comprimeren|converteren|verwijderen|uitvoeren)\b/i],
  ['pl', /\b(?:kompresuj|konwertuj|usuń|wykonaj)\b/i],
  ['sv', /\b(?:komprimera|konvertera|kör)\b/i],
  ['tr', /\b(?:sıkıştır|dönüştür|kaldır|çalıştır)\b/i],
  ['id', /\b(?:kompres|ubah|hapus|jalankan)\b/i],
  ['ms', /\b(?:mampat|tukar|buang|jalankan)\b/i],
  ['vi', /\b(?:nén|chuyển đổi|xóa|thực hiện)\b/i],
  ['ru', /\b(?:сжать|конвертировать|удалить|выполнить)\b/i],
  ['uk', /\b(?:стиснути|конвертувати|видалити|виконати)\b/i],
];

const KEYWORDS: Readonly<Record<Locale, readonly string[]>> = {
  ar: ['الصورة', 'صورة', 'خلفية', 'اضغط', 'ضغط', 'حجم', 'حول', 'تحويل', 'أزل', 'اجعل', 'نفذ', 'نفّذ'],
  en: ['image', 'photo', 'background', 'compress', 'convert', 'resize', 'remove', 'make', 'execute', 'run'],
  es: ['imagen', 'foto', 'fondo', 'comprimir', 'convertir', 'cambiar', 'quitar', 'ejecutar'],
  fr: ['image', 'photo', 'arrière-plan', 'compresser', 'convertir', 'redimensionner', 'supprimer', 'exécuter'],
  de: ['bild', 'foto', 'hintergrund', 'komprimieren', 'konvertieren', 'skalieren', 'entfernen', 'ausführen'],
  hi: ['छवि', 'तस्वीर', 'पृष्ठभूमि', 'संपीड़ित', 'बदलें', 'हटाएं', 'चलाएं'],
  id: ['gambar', 'foto', 'latar', 'kompres', 'ubah', 'hapus', 'jalankan'],
  it: ['immagine', 'foto', 'sfondo', 'comprimere', 'convertire', 'ridimensionare', 'rimuovere', 'eseguire'],
  ja: ['画像', '写真', '背景', '圧縮', '変換', 'リサイズ', '削除', '実行'],
  ko: ['이미지', '사진', '배경', '압축', '변환', '크기', '제거', '실행'],
  ms: ['imej', 'gambar', 'foto', 'latar', 'mampat', 'tukar', 'buang', 'jalankan'],
  nl: ['afbeelding', 'foto', 'achtergrond', 'comprimeren', 'converteren', 'verwijderen', 'uitvoeren'],
  pl: ['obraz', 'zdjęcie', 'tło', 'kompresuj', 'konwertuj', 'usuń', 'wykonaj'],
  pt: ['imagem', 'foto', 'fundo', 'comprimir', 'converter', 'redimensionar', 'remover', 'executar'],
  ru: ['изображение', 'изображения', 'фото', 'фон', 'сжать', 'конвертировать', 'изменить размер', 'удалить', 'выполнить'],
  sv: ['bild', 'foto', 'bakgrund', 'komprimera', 'konvertera', 'ändra storlek', 'ta bort', 'kör'],
  th: ['รูปภาพ', 'ภาพ', 'พื้นหลัง', 'บีบอัด', 'แปลง', 'ลบ', 'เรียกใช้'],
  tr: ['resim', 'fotoğraf', 'arka plan', 'sıkıştır', 'dönüştür', 'yeniden boyutlandır', 'kaldır', 'çalıştır'],
  uk: ['зображення', 'зображенням', 'фото', 'фон', 'стиснути', 'конвертувати', 'змінити розмір', 'видалити', 'виконати'],
  vi: ['hình ảnh', 'ảnh', 'nền', 'nén', 'chuyển đổi', 'đổi kích thước', 'xóa', 'thực hiện'],
};

const DISTINCTIVE_KEYWORDS: Readonly<Record<Locale, readonly string[]>> = {
  ar: ['اضغط', 'أزل', 'اجعل', 'نفذ', 'نفّذ'],
  en: ['compress', 'background', 'resize', 'remove', 'execute'],
  es: ['comprimir', 'cambiar', 'quitar', 'ejecutar'],
  fr: ['compresser', 'redimensionner', 'supprimer', 'exécuter'],
  de: ['komprimieren', 'konvertieren', 'skalieren', 'entfernen', 'ausführen'],
  hi: ['संपीड़ित', 'बदलें', 'हटाएं', 'चलाएं'],
  id: ['kompres', 'ubah', 'hapus', 'jalankan'],
  it: ['comprimere', 'convertire', 'ridimensionare', 'rimuovere', 'eseguire'],
  ja: ['圧縮', '変換', 'リサイズ', '削除', '実行'],
  ko: ['압축', '변환', '제거', '실행'],
  ms: ['mampat', 'tukar', 'buang', 'jalankan'],
  nl: ['comprimeren', 'converteren', 'verwijderen', 'uitvoeren'],
  pl: ['kompresuj', 'konwertuj', 'usuń', 'wykonaj'],
  pt: ['comprimir', 'converter', 'redimensionar', 'remover', 'executar'],
  ru: ['сжать', 'конвертировать', 'удалить', 'выполнить'],
  sv: ['komprimera', 'konvertera', 'ta bort', 'kör'],
  th: ['บีบอัด', 'แปลง', 'ลบ', 'เรียกใช้'],
  tr: ['sıkıştır', 'dönüştür', 'yeniden boyutlandır', 'kaldır', 'çalıştır'],
  uk: ['стиснути', 'конвертувати', 'видалити', 'виконати'],
  vi: ['nén', 'chuyển đổi', 'đổi kích thước', 'xóa', 'thực hiện'],
};

const MIN_CONFIDENT_SCORE = 4;
const LOCALE_PRIORITY: readonly Locale[] = [...LOCALES];

const normalizeForMatch = (text: string): string =>
  text
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[’‘`´]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedKeywords = new Map<Locale, readonly string[]>(
  LOCALES.map((locale) => [locale, KEYWORDS[locale].map(normalizeForMatch)]),
);
const normalizedDistinctiveKeywords = new Map<Locale, readonly string[]>(
  LOCALES.map((locale) => [locale, DISTINCTIVE_KEYWORDS[locale].map(normalizeForMatch)]),
);

const scoreLocale = (text: string, locale: Locale): number => {
  const keywords = normalizedKeywords.get(locale) ?? [];
  const distinctive = normalizedDistinctiveKeywords.get(locale) ?? [];
  let score = 0;

  for (const keyword of keywords) {
    if (!keyword) continue;
    if (text.includes(keyword)) score += keyword.includes(' ') ? 3 : 2;
  }

  for (const keyword of distinctive) {
    if (!keyword) continue;
    if (text.includes(keyword)) score += 8;
  }

  return score;
};

export function detectAgentLocale(text: string, fallback: Locale): Locale {
  const normalized = normalizeForMatch(text);
  if (!normalized) return fallback;

  for (const [locale, pattern] of SCRIPT_RULES) {
    if (pattern.test(text)) return locale;
  }

  for (const [locale, pattern] of LANGUAGE_SIGNATURES) {
    if (pattern.test(text)) return locale;
  }

  let best: Locale = fallback;
  let bestScore = 0;

  for (const locale of LOCALE_PRIORITY) {
    const score = scoreLocale(normalized, locale);
    if (score > bestScore || (score === bestScore && score > 0 && locale === fallback)) {
      best = locale;
      bestScore = score;
    }
  }

  return bestScore >= MIN_CONFIDENT_SCORE ? best : fallback;
}
