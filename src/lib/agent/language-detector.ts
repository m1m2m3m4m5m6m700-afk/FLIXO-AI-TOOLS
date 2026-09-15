import { LOCALES, type Locale } from '@/lib/i18n';

const SCRIPT_RULES: readonly [Locale, RegExp][] = [
  ['ar', /[\u0600-\u06FF]/],
  ['hi', /[\u0900-\u097F]/],
  ['th', /[\u0E00-\u0E7F]/],
  ['ja', /[\u3040-\u30FF]/],
  ['ko', /[\uAC00-\uD7AF]/],
  ['ru', /[\u0400-\u04FF]/],
  ['uk', /[\u0400-\u04FF]/],
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
  ru: ['изображение', 'фото', 'фон', 'сжать', 'конвертировать', 'изменить размер', 'удалить', 'выполнить'],
  sv: ['bild', 'foto', 'bakgrund', 'komprimera', 'konvertera', 'ändra storlek', 'ta bort', 'kör'],
  th: ['รูปภาพ', 'ภาพ', 'พื้นหลัง', 'บีบอัด', 'แปลง', 'ลบ', 'เรียกใช้'],
  tr: ['resim', 'fotoğraf', 'arka plan', 'sıkıştır', 'dönüştür', 'yeniden boyutlandır', 'kaldır', 'çalıştır'],
  uk: ['зображення', 'фото', 'фон', 'стиснути', 'конвертувати', 'змінити розмір', 'видалити', 'виконати'],
  vi: ['hình ảnh', 'ảnh', 'nền', 'nén', 'chuyển đổi', 'đổi kích thước', 'xóa', 'thực hiện'],
};

const latinLocales = new Set<Locale>(LOCALES.filter((locale) => !SCRIPT_RULES.some(([candidate]) => candidate === locale)));

export function detectAgentLocale(text: string, fallback: Locale): Locale {
  const normalized = text.trim().toLocaleLowerCase();
  if (!normalized) return fallback;

  for (const [locale, pattern] of SCRIPT_RULES) {
    if (pattern.test(normalized)) return locale;
  }

  let best: Locale = fallback;
  let bestScore = 0;
  for (const locale of latinLocales) {
    const words = KEYWORDS[locale] ?? [];
    const score = words.reduce((total, word) => total + (normalized.includes(word.toLocaleLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      best = locale;
      bestScore = score;
    }
  }

  return best;
}
