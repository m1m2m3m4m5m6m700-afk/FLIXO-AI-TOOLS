import type { Locale } from './config';

export const CATEGORY_LABELS: Record<Locale, { Images: string }> = {
  ar: { Images: 'الصور' }, en: { Images: 'Images' }, es: { Images: 'Imágenes' }, fr: { Images: 'Images' }, de: { Images: 'Bilder' }, hi: { Images: 'छवियाँ' }, id: { Images: 'Gambar' }, it: { Images: 'Immagini' }, ja: { Images: '画像' }, ko: { Images: '이미지' }, ms: { Images: 'Imej' }, nl: { Images: 'Afbeeldingen' }, pl: { Images: 'Obrazy' }, pt: { Images: 'Imagens' }, ru: { Images: 'Изображения' }, sv: { Images: 'Bilder' }, th: { Images: 'รูปภาพ' }, tr: { Images: 'Görseller' }, uk: { Images: 'Зображення' }, vi: { Images: 'Hình ảnh' }, zh: { Images: '图像' }, ur: { Images: 'تصاویر' },
};

type LocalizedTerms = Partial<Record<Locale, string>>;
const TERMS: Record<string, LocalizedTerms> = {
  image: { ar: 'صورة', es: 'Imagen', fr: 'Image', de: 'Bild', ru: 'Изображение', zh: '图像', hi: 'छवि', id: 'Gambar', ur: 'تصویر', ja: '画像', pt: 'Imagem', it: 'Immagine', ko: '이미지', nl: 'Afbeelding', pl: 'Obraz', tr: 'Görsel', vi: 'Hình ảnh', th: 'รูปภาพ', sv: 'Bild', ms: 'Imej', uk: 'Зображення' },
  images: { ar: 'الصور', es: 'Imágenes', fr: 'Images', de: 'Bilder', ru: 'Изображения', zh: '图像', hi: 'छवियाँ', id: 'Gambar', ur: 'تصاویر', ja: '画像', pt: 'Imagens', it: 'Immagini', ko: '이미지', nl: 'Afbeeldingen', pl: 'Obrazy', tr: 'Görseller', vi: 'Hình ảnh', th: 'รูปภาพ', sv: 'Bilder', ms: 'Imej', uk: 'Зображення' },
  photo: { ar: 'صورة', es: 'Foto', fr: 'Photo', de: 'Foto', ru: 'Фото', zh: '照片', hi: 'फ़ोटो', id: 'Foto', ur: 'تصویر', ja: '写真', pt: 'Foto', it: 'Foto', ko: '사진', nl: 'Foto', pl: 'Zdjęcie', tr: 'Fotoğraf', vi: 'Ảnh', th: 'ภาพถ่าย', sv: 'Foto', ms: 'Foto', uk: 'Фото' },
  background: { ar: 'الخلفية', es: 'Fondo', fr: 'Arrière-plan', de: 'Hintergrund', ru: 'Фон', zh: '背景', hi: 'पृष्ठभूमि', id: 'Latar belakang', ur: 'پس منظر', ja: '背景', pt: 'Fundo', it: 'Sfondo', ko: '배경', nl: 'Achtergrond', pl: 'Tło', tr: 'Arka plan', vi: 'Nền', th: 'พื้นหลัง', sv: 'Bakgrund', ms: 'Latar belakang', uk: 'Фон' },
  blur: { ar: 'ضبابية', es: 'Desenfoque', fr: 'Flou', de: 'Weichzeichnen', ru: 'Размытие', zh: '模糊', hi: 'धुंधलापन', id: 'Buram', ur: 'دھندلا', ja: 'ぼかし', pt: 'Desfoque', it: 'Sfocatura', ko: '흐림', nl: 'Vervagen', pl: 'Rozmycie', tr: 'Bulanıklaştırma', vi: 'Làm mờ', th: 'เบลอ', sv: 'Oskärpa', ms: 'Kabur', uk: 'Розмиття' },
  remove: { ar: 'إزالة', es: 'Eliminar', fr: 'Supprimer', de: 'Entfernen', ru: 'Удаление', zh: '移除', hi: 'हटाना', id: 'Hapus', ur: 'ہٹانا', ja: '削除', pt: 'Remover', it: 'Rimuovi', ko: '제거', nl: 'Verwijderen', pl: 'Usuwanie', tr: 'Kaldırma', vi: 'Xóa', th: 'ลบ', sv: 'Ta bort', ms: 'Buang', uk: 'Видалення' },
  remover: { ar: 'إزالة', es: 'Eliminador', fr: 'Suppression', de: 'Entferner', ru: 'Удаление', zh: '移除器', hi: 'हटाने वाला', id: 'Penghapus', ur: 'ہٹانے والا', ja: '削除', pt: 'Removedor', it: 'Rimozione', ko: '제거기', nl: 'Verwijderaar', pl: 'Usuwanie', tr: 'Kaldırıcı', vi: 'Công cụ xóa', th: 'ตัวลบ', sv: 'Borttagning', ms: 'Penyingkir', uk: 'Засіб видалення' },
  compressor: { ar: 'ضاغط', es: 'Compresor', fr: 'Compresseur', de: 'Kompressor', ru: 'Компрессор', zh: '压缩器', hi: 'कंप्रेसर', id: 'Kompresor', ur: 'کمپریسر', ja: '圧縮', pt: 'Compressor', it: 'Compressore', ko: '압축기', nl: 'Compressor', pl: 'Kompresor', tr: 'Sıkıştırıcı', vi: 'Trình nén', th: 'ตัวบีบอัด', sv: 'Kompressor', ms: 'Pemampat', uk: 'Компресор' },
  converter: { ar: 'محول', es: 'Convertidor', fr: 'Convertisseur', de: 'Konverter', ru: 'Конвертер', zh: '转换器', hi: 'कनवर्टर', id: 'Konverter', ur: 'کنورٹر', ja: '変換', pt: 'Conversor', it: 'Convertitore', ko: '변환기', nl: 'Converter', pl: 'Konwerter', tr: 'Dönüştürücü', vi: 'Trình chuyển đổi', th: 'ตัวแปลง', sv: 'Konverterare', ms: 'Penukar', uk: 'Конвертер' },
  cutter: { ar: 'قاصّ', es: 'Cortador', fr: 'Découpeur', de: 'Schneider', ru: 'Обрезчик', zh: '剪辑器', hi: 'कटर', id: 'Pemotong', ur: 'کٹّر', ja: 'カッター', pt: 'Cortador', it: 'Taglierina', ko: '커터', nl: 'Snijder', pl: 'Przycinarka', tr: 'Kesici', vi: 'Trình cắt', th: 'ตัวตัด', sv: 'Klippen', ms: 'Pemotong', uk: 'Обрізувач' },
  trimmer: { ar: 'مُشذِّب', es: 'Recortador', fr: 'Découpeur', de: 'Trimmer', ru: 'Триммер', zh: '修剪器', hi: 'ट्रिमर', id: 'Pemangkas', ur: 'ٹرمر', ja: 'トリマー', pt: 'Cortador', it: 'Ritagliatore', ko: '트리머', nl: 'Trimmer', pl: 'Trymer', tr: 'Kırpıcı', vi: 'Trình cắt', th: 'ตัวตัด', sv: 'Trimverktyg', ms: 'Pemangkas', uk: 'Тример' },
  generator: { ar: 'مولد', es: 'Generador', fr: 'Générateur', de: 'Generator', ru: 'Генератор', zh: '生成器', hi: 'जनरेटर', id: 'Generator', ur: 'جنریٹر', ja: '生成器', pt: 'Gerador', it: 'Generatore', ko: '생성기', nl: 'Generator', pl: 'Generator', tr: 'Oluşturucu', vi: 'Trình tạo', th: 'ตัวสร้าง', sv: 'Generator', ms: 'Penjana', uk: 'Генератор' },
  maker: { ar: 'منشئ', es: 'Creador', fr: 'Créateur', de: 'Ersteller', ru: 'Создатель', zh: '制作器', hi: 'निर्माता', id: 'Pembuat', ur: 'بنانے والا', ja: '作成', pt: 'Criador', it: 'Creatore', ko: '메이커', nl: 'Maker', pl: 'Twórca', tr: 'Oluşturucu', vi: 'Trình tạo', th: 'ตัวสร้าง', sv: 'Skapare', ms: 'Pembuat', uk: 'Створювач' },
  optimizer: { ar: 'محسن', es: 'Optimizador', fr: 'Optimiseur', de: 'Optimierer', ru: 'Оптимизатор', zh: '优化器', hi: 'ऑप्टिमाइज़र', id: 'Pengoptimal', ur: 'بہتر ساز', ja: '最適化', pt: 'Otimizador', it: 'Ottimizzatore', ko: '최적화기', nl: 'Optimalisator', pl: 'Optymalizator', tr: 'İyileştirici', vi: 'Trình tối ưu', th: 'ตัวเพิ่มประสิทธิภาพ', sv: 'Optimerare', ms: 'Pengoptimum', uk: 'Оптимізатор' },
  upscaler: { ar: 'مكبّر', es: 'Ampliador', fr: 'Agrandisseur', de: 'Hochskalierer', ru: 'Масштабировщик', zh: '放大器', hi: 'अपस्केलर', id: 'Peningkat resolusi', ur: 'ریزولوشن بڑھانے والا', ja: '高画質化', pt: 'Ampliador', it: 'Ingranditore', ko: '업스케일러', nl: 'Upscaler', pl: 'Skalowanie', tr: 'Büyütücü', vi: 'Tăng độ phân giải', th: 'เพิ่มความละเอียด', sv: 'Uppskalare', ms: 'Penskala', uk: 'Масштабувальник' },
  watermark: { ar: 'علامة مائية', es: 'Marca de agua', fr: 'Filigrane', de: 'Wasserzeichen', ru: 'Водяной знак', zh: '水印', hi: 'वॉटरमार्क', id: 'Tanda air', ur: 'واٹر مارک', ja: '透かし', pt: 'Marca d’água', it: 'Filigrana', ko: '워터마크', nl: 'Watermerk', pl: 'Znak wodny', tr: 'Filigran', vi: 'Hình mờ', th: 'ลายน้ำ', sv: 'Vattenstämpel', ms: 'Tanda air', uk: 'Водяний знак' },
  object: { ar: 'عنصر', es: 'Objeto', fr: 'Objet', de: 'Objekt', ru: 'Объект', zh: '对象', hi: 'वस्तु', id: 'Objek', ur: 'آبجیکٹ', ja: 'オブジェクト', pt: 'Objeto', it: 'Oggetto', ko: '개체', nl: 'Object', pl: 'Obiekt', tr: 'Nesne', vi: 'Đối tượng', th: 'วัตถุ', sv: 'Objekt', ms: 'Objek', uk: 'Об’єкт' },
  text: { ar: 'النص', es: 'Texto', fr: 'Texte', de: 'Text', ru: 'Текст', zh: '文本', hi: 'टेक्स्ट', id: 'Teks', ur: 'متن', ja: 'テキスト', pt: 'Texto', it: 'Testo', ko: '텍스트', nl: 'Tekst', pl: 'Tekst', tr: 'Metin', vi: 'Văn bản', th: 'ข้อความ', sv: 'Text', ms: 'Teks', uk: 'Текст' },
  online: { ar: 'عبر الإنترنت', es: 'en línea', fr: 'en ligne', de: 'online', ru: 'онлайн', zh: '在线', hi: 'ऑनलाइन', id: 'online', ur: 'آن لائن', ja: 'オンライン', pt: 'online', it: 'online', ko: '온라인', nl: 'online', pl: 'online', tr: 'çevrimiçi', vi: 'trực tuyến', th: 'ออนไลน์', sv: 'online', ms: 'dalam talian', uk: 'онлайн' },
  to: { ar: 'إلى', es: 'a', fr: 'vers', de: 'zu', ru: 'в', zh: '到', hi: 'से', id: 'ke', ur: 'تک', ja: 'へ', pt: 'para', it: 'a', ko: '로', nl: 'naar', pl: 'do', tr: 'için', vi: 'sang', th: 'ไปยัง', sv: 'till', ms: 'ke', uk: 'до' },
  from: { ar: 'من', es: 'de', fr: 'de', de: 'aus', ru: 'из', zh: '从', hi: 'से', id: 'dari', ur: 'سے', ja: 'から', pt: 'de', it: 'da', ko: '에서', nl: 'van', pl: 'z', tr: 'dan', vi: 'từ', th: 'จาก', sv: 'från', ms: 'dari', uk: 'з' },
  svg: { ar: 'SVG', es: 'SVG', fr: 'SVG', de: 'SVG', ru: 'SVG', zh: 'SVG', hi: 'SVG', id: 'SVG', ur: 'SVG', ja: 'SVG', pt: 'SVG', it: 'SVG', ko: 'SVG', nl: 'SVG', pl: 'SVG', tr: 'SVG', vi: 'SVG', th: 'SVG', sv: 'SVG', ms: 'SVG', uk: 'SVG' },
  ocr: { ar: 'OCR', es: 'OCR', fr: 'OCR', de: 'OCR', ru: 'OCR', zh: 'OCR', hi: 'OCR', id: 'OCR', ur: 'OCR', ja: 'OCR', pt: 'OCR', it: 'OCR', ko: 'OCR', nl: 'OCR', pl: 'OCR', tr: 'OCR', vi: 'OCR', th: 'OCR', sv: 'OCR', ms: 'OCR', uk: 'OCR' },
};

const CONNECTORS: Record<string, boolean> = { and: true, of: true, the: true, a: true, to: true, from: true, in: true, on: true, for: true, online: true };
const TECHNICAL_TOKENS = new Set(['SVG', 'OCR', 'EXIF', 'JPG', 'PNG', 'WebP', 'ZIP']);

type ToolTitleOverride = Partial<Record<Locale, string>>;
const TITLE_OVERRIDES: Record<string, ToolTitleOverride> = {
  'image ocr': { fr: 'OCR d’image' },
  'svg optimizer': { nl: 'SVG-optimalisatie' },
};

function tokenize(value: string): string[] {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
}

function fallbackTitle(locale: Locale, category: 'Images'): string {
  const label = CATEGORY_LABELS[locale][category];
  const templates: Record<Locale, string> = {
    ar: `أداة ${label}`, en: `Tool ${label}`, es: `Herramienta de ${label}`, fr: `Outil ${label}`, de: `${label}-Werkzeug`, ru: `Инструмент ${label}`, zh: `${label}工具`, hi: `${label} टूल`, id: `Alat ${label}`, ur: `${label} ٹول`, ja: `${label}ツール`, pt: `Ferramenta de ${label}`, it: `Strumento ${label}`, ko: `${label} 도구`, nl: `${label}-tool`, pl: `Narzędzie ${label}`, tr: `${label} aracı`, vi: `Công cụ ${label}`, th: `เครื่องมือ${label}`, sv: `${label}-verktyg`, ms: `Alat ${label}`, uk: `Інструмент ${label}`,
  };
  return templates[locale];
}

export function localizeToolCategory(locale: Locale, category: 'Images'): string {
  return CATEGORY_LABELS[locale][category];
}

export function localizeToolTitle(locale: Locale, title: string, category: 'Images'): string {
  if (locale === 'en') return title;
  const normalizedTitleKey = title.trim().toLowerCase();
  const override = TITLE_OVERRIDES[normalizedTitleKey];
  if (override?.[locale]) return override[locale] as string;
  const parts = tokenize(title);
  const translated = parts.map((part) => {
    const key = part.toLowerCase();
    const direct = TERMS[key]?.[locale];
    if (direct) return direct;
    if (TECHNICAL_TOKENS.has(part)) return part;
    if (CONNECTORS[key]) return TERMS[key]?.[locale] ?? part;
    return part;
  });
  const result = translated.join(' ').trim();
  return result && result.toLowerCase() !== title.trim().toLowerCase() ? result : fallbackTitle(locale, category);
}

export function localizeToolDescription(locale: Locale, title: string, category: 'Images'): string {
  const localizedTitle = localizeToolTitle(locale, title, category);
  const templates: Record<Locale, string> = {
    ar: `استخدم ${localizedTitle} من FLIXO مباشرة داخل المتصفح.`, en: `Use ${localizedTitle} in FLIXO directly in your browser.`, es: `Usa ${localizedTitle} de FLIXO directamente en tu navegador.`, fr: `Utilisez ${localizedTitle} de FLIXO directement dans votre navigateur.`, de: `Nutzen Sie ${localizedTitle} von FLIXO direkt im Browser.`, ru: `Используйте ${localizedTitle} от FLIXO прямо в браузере.`, zh: `直接在浏览器中使用 FLIXO 的${localizedTitle}。`, hi: `FLIXO के ${localizedTitle} का उपयोग सीधे ब्राउज़र में करें।`, id: `Gunakan ${localizedTitle} dari FLIXO langsung di browser.`, ur: `FLIXO کا ${localizedTitle} براہِ راست براؤزر میں استعمال کریں۔`, ja: `FLIXO の${localizedTitle}をブラウザで直接利用できます。`, pt: `Use ${localizedTitle} da FLIXO diretamente no navegador.`, it: `Usa ${localizedTitle} di FLIXO direttamente nel browser.`, ko: `브라우저에서 FLIXO의 ${localizedTitle}을(를) 바로 사용하세요.`, nl: `Gebruik ${localizedTitle} van FLIXO direct in je browser.`, pl: `Używaj ${localizedTitle} FLIXO bezpośrednio w przeglądarce.`, tr: `FLIXO ${localizedTitle} aracını doğrudan tarayıcıda kullanın.`, vi: `Sử dụng ${localizedTitle} của FLIXO ngay trong trình duyệt.`, th: `ใช้ ${localizedTitle} ของ FLIXO ได้โดยตรงในเบราว์เซอร์`, sv: `Använd FLIXO:s ${localizedTitle} direkt i webbläsaren.`, ms: `Gunakan ${localizedTitle} FLIXO terus dalam pelayar anda.`, uk: `Використовуйте ${localizedTitle} FLIXO безпосередньо у браузері.`,
  };
  return templates[locale];
}
