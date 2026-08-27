import type { Locale } from './config';

const CATEGORY_LABELS: Record<Locale, Record<'Images' | 'AI' | 'Other', string>> = {
  en: { Images: 'Images', AI: 'AI', Other: 'Other' }, ar: { Images: 'الصور', AI: 'الذكاء الاصطناعي', Other: 'أخرى' }, es: { Images: 'Imágenes', AI: 'IA', Other: 'Otros' }, fr: { Images: 'Images', AI: 'IA', Other: 'Autres' }, de: { Images: 'Bilder', AI: 'KI', Other: 'Andere' }, ru: { Images: 'Изображения', AI: 'ИИ', Other: 'Другое' }, zh: { Images: '图像', AI: '人工智能', Other: '其他' }, hi: { Images: 'छवियाँ', AI: 'एआई', Other: 'अन्य' }, id: { Images: 'Gambar', AI: 'AI', Other: 'Lainnya' }, ur: { Images: 'تصاویر', AI: 'اے آئی', Other: 'دیگر' }, ja: { Images: '画像', AI: 'AI', Other: 'その他' }, pt: { Images: 'Imagens', AI: 'IA', Other: 'Outros' }, it: { Images: 'Immagini', AI: 'IA', Other: 'Altro' }, ko: { Images: '이미지', AI: 'AI', Other: '기타' }, nl: { Images: 'Afbeeldingen', AI: 'AI', Other: 'Overig' }, pl: { Images: 'Obrazy', AI: 'AI', Other: 'Inne' }, tr: { Images: 'Görseller', AI: 'YZ', Other: 'Diğer' }, vi: { Images: 'Hình ảnh', AI: 'AI', Other: 'Khác' }, th: { Images: 'รูปภาพ', AI: 'AI', Other: 'อื่นๆ' }, sv: { Images: 'Bilder', AI: 'AI', Other: 'Övrigt' },
};

const TERMS: Record<string, Partial<Record<Locale, string>>> = {
  image: { ar: 'صورة', es: 'Imagen', fr: 'Image', de: 'Bild', ru: 'Изображение', zh: '图像', hi: 'छवि', id: 'Gambar', ur: 'تصویر', ja: '画像', pt: 'Imagem', it: 'Immagine', ko: '이미지', nl: 'Afbeelding', pl: 'Obraz', tr: 'Görsel', vi: 'Hình ảnh', th: 'รูปภาพ', sv: 'Bild' },
  images: { ar: 'الصور', es: 'Imágenes', fr: 'Images', de: 'Bilder', ru: 'Изображения', zh: '图像', hi: 'छवियाँ', id: 'Gambar', ur: 'تصاویر', ja: '画像', pt: 'Imagens', it: 'Immagini', ko: '이미지', nl: 'Afbeeldingen', pl: 'Obrazy', tr: 'Görseller', vi: 'Hình ảnh', th: 'รูปภาพ', sv: 'Bilder' },
  background: { ar: 'الخلفية', es: 'Fondo', fr: 'Arrière-plan', de: 'Hintergrund', ru: 'Фон', zh: '背景', hi: 'पृष्ठभूमि', id: 'Latar Belakang', ur: 'پس منظر', ja: '背景', pt: 'Fundo', it: 'Sfondo', ko: '배경', nl: 'Achtergrond', pl: 'Tło', tr: 'Arka Plan', vi: 'Nền', th: 'พื้นหลัง', sv: 'Bakgrund' },
  remove: { ar: 'إزالة', es: 'Eliminar', fr: 'Supprimer', de: 'Entfernen', ru: 'Удаление', zh: '移除', hi: 'हटाना', id: 'Hapus', ur: 'ہٹانا', ja: '削除', pt: 'Remover', it: 'Rimuovi', ko: '제거', nl: 'Verwijderen', pl: 'Usuwanie', tr: 'Kaldırma', vi: 'Xóa', th: 'ลบ', sv: 'Ta bort' },
  remover: { ar: 'إزالة', es: 'Eliminador', fr: 'Suppression', de: 'Entferner', ru: 'Удаление', zh: '移除器', hi: 'हटाने वाला', id: 'Penghapus', ur: 'ہٹانے والا', ja: '削除', pt: 'Removedor', it: 'Rimozione', ko: '제거기', nl: 'Verwijderaar', pl: 'Usuwanie', tr: 'Kaldırıcı', vi: 'Công cụ xóa', th: 'ตัวลบ', sv: 'Borttagning' },
  compressor: { ar: 'ضاغط', es: 'Compresor', fr: 'Compresseur', de: 'Kompressor', ru: 'Компрессор', zh: '压缩器', hi: 'कंप्रेसर', id: 'Kompresor', ur: 'کمپریسر', ja: '圧縮', pt: 'Compressor', it: 'Compressore', ko: '압축기', nl: 'Compressor', pl: 'Kompresor', tr: 'Sıkıştırıcı', vi: 'Trình nén', th: 'ตัวบีบอัด', sv: 'Kompressor' },
  converter: { ar: 'محول', es: 'Convertidor', fr: 'Convertisseur', de: 'Konverter', ru: 'Конвертер', zh: '转换器', hi: 'कनवर्टर', id: 'Konverter', ur: 'کنورٹر', ja: '変換', pt: 'Conversor', it: 'Convertitore', ko: '변환기', nl: 'Converter', pl: 'Konwerter', tr: 'Dönüştürücü', vi: 'Trình chuyển đổi', th: 'ตัวแปลง', sv: 'Konverterare' },
  cropper: { ar: 'مقص', es: 'Recortador', fr: 'Rognage', de: 'Zuschneider', ru: 'Обрезка', zh: '裁剪器', hi: 'क्रॉपर', id: 'Pemotong', ur: 'کراپر', ja: '切り抜き', pt: 'Cortador', it: 'Ritaglio', ko: '자르기', nl: 'Uitsnijder', pl: 'Przycinanie', tr: 'Kırpıcı', vi: 'Trình cắt', th: 'ตัวครอป', sv: 'Beskärare' },
  blur: { ar: 'ضبابية', es: 'Desenfoque', fr: 'Flou', de: 'Weichzeichnen', ru: 'Размытие', zh: '模糊', hi: 'धुंधलापन', id: 'Buram', ur: 'دھندلا', ja: 'ぼかし', pt: 'Desfoque', it: 'Sfocatura', ko: '흐림', nl: 'Vervagen', pl: 'Rozmycie', tr: 'Bulanıklaştırma', vi: 'Làm mờ', th: 'เบลอ', sv: 'Oskärpa' },
  watermark: { ar: 'علامة مائية', es: 'Marca de agua', fr: 'Filigrane', de: 'Wasserzeichen', ru: 'Водяной знак', zh: '水印', hi: 'वॉटरमार्क', id: 'Tanda Air', ur: 'واٹر مارک', ja: '透かし', pt: 'Marca d’água', it: 'Filigrana', ko: '워터마크', nl: 'Watermerk', pl: 'Znak wodny', tr: 'Filigran', vi: 'Hình mờ', th: 'ลายน้ำ', sv: 'Vattenstämpel' },
  add: { ar: 'إضافة', es: 'Añadir', fr: 'Ajouter', de: 'Hinzufügen', ru: 'Добавить', zh: '添加', hi: 'जोड़ें', id: 'Tambah', ur: 'شامل کرنا', ja: '追加', pt: 'Adicionar', it: 'Aggiungi', ko: '추가', nl: 'Toevoegen', pl: 'Dodaj', tr: 'Ekle', vi: 'Thêm', th: 'เพิ่ม', sv: 'Lägg till' },
  generator: { ar: 'مولد', es: 'Generador', fr: 'Générateur', de: 'Generator', ru: 'Генератор', zh: '生成器', hi: 'जनरेटर', id: 'Generator', ur: 'جنریٹر', ja: '生成', pt: 'Gerador', it: 'Generatore', ko: '생성기', nl: 'Generator', pl: 'Generator', tr: 'Oluşturucu', vi: 'Trình tạo', th: 'ตัวสร้าง', sv: 'Generator' },
  maker: { ar: 'منشئ', es: 'Creador', fr: 'Créateur', de: 'Ersteller', ru: 'Создатель', zh: '制作器', hi: 'निर्माता', id: 'Pembuat', ur: 'بنانے والا', ja: '作成', pt: 'Criador', it: 'Creatore', ko: '메이커', nl: 'Maker', pl: 'Twórca', tr: 'Oluşturucu', vi: 'Trình tạo', th: 'ตัวสร้าง', sv: 'Skapare' },
  optimizer: { ar: 'محسن', es: 'Optimizador', fr: 'Optimiseur', de: 'Optimierer', ru: 'Оптимизатор', zh: '优化器', hi: 'ऑप्टिमाइज़र', id: 'Pengoptimal', ur: 'بہتر ساز', ja: '最適化', pt: 'Otimizador', it: 'Ottimizzatore', ko: '최적화', nl: 'Optimizer', pl: 'Optymalizator', tr: 'Optimize Edici', vi: 'Trình tối ưu', th: 'ตัวเพิ่มประสิทธิภาพ', sv: 'Optimerare' },
  upscaler: { ar: 'تكبير', es: 'Escalador', fr: 'Agrandisseur', de: 'Hochskalierer', ru: 'Масштабирование', zh: '放大器', hi: 'अपस्केलर', id: 'Peningkat Resolusi', ur: 'بڑھانے والا', ja: '高画質化', pt: 'Aumentador', it: 'Upscaler', ko: '업스케일러', nl: 'Upscaler', pl: 'Skalowanie', tr: 'Büyütücü', vi: 'Tăng độ phân giải', th: 'เพิ่มความละเอียด', sv: 'Uppskalare' },
  audio: { ar: 'الصوت', es: 'Audio', fr: 'Audio', de: 'Audio', ru: 'Аудио', zh: '音频', hi: 'ऑडियो', id: 'Audio', ur: 'آڈیو', ja: '音声', pt: 'Áudio', it: 'Audio', ko: '오디오', nl: 'Audio', pl: 'Audio', tr: 'Ses', vi: 'Âm thanh', th: 'เสียง', sv: 'Ljud' },
  video: { ar: 'الفيديو', es: 'Vídeo', fr: 'Vidéo', de: 'Video', ru: 'Видео', zh: '视频', hi: 'वीडियो', id: 'Video', ur: 'ویڈیو', ja: '動画', pt: 'Vídeo', it: 'Video', ko: '비디오', nl: 'Video', pl: 'Wideo', tr: 'Video', vi: 'Video', th: 'วิดีโอ', sv: 'Video' },
  text: { ar: 'النص', es: 'Texto', fr: 'Texte', de: 'Text', ru: 'Текст', zh: '文本', hi: 'टेक्स्ट', id: 'Teks', ur: 'متن', ja: 'テキスト', pt: 'Texto', it: 'Testo', ko: '텍스트', nl: 'Tekst', pl: 'Tekst', tr: 'Metin', vi: 'Văn bản', th: 'ข้อความ', sv: 'Text' },
  counter: { ar: 'عداد', es: 'Contador', fr: 'Compteur', de: 'Zähler', ru: 'Счётчик', zh: '计数器', hi: 'काउंटर', id: 'Penghitung', ur: 'شمارندہ', ja: 'カウンター', pt: 'Contador', it: 'Contatore', ko: '카운터', nl: 'Teller', pl: 'Licznik', tr: 'Sayaç', vi: 'Bộ đếm', th: 'ตัวนับ', sv: 'Räknare' },
  checker: { ar: 'مدقق', es: 'Comprobador', fr: 'Vérificateur', de: 'Prüfer', ru: 'Проверка', zh: '检查器', hi: 'चेकर', id: 'Pemeriksa', ur: 'چیکر', ja: 'チェッカー', pt: 'Verificador', it: 'Verificatore', ko: '검사기', nl: 'Controle', pl: 'Sprawdzacz', tr: 'Denetleyici', vi: 'Trình kiểm tra', th: 'ตัวตรวจสอบ', sv: 'Kontroll' },
  formatter: { ar: 'منسق', es: 'Formateador', fr: 'Formateur', de: 'Formatierer', ru: 'Форматтер', zh: '格式化器', hi: 'फॉर्मैटर', id: 'Pemformat', ur: 'فارمیٹر', ja: 'フォーマッター', pt: 'Formatador', it: 'Formattatore', ko: '포맷터', nl: 'Formatter', pl: 'Formater', tr: 'Biçimlendirici', vi: 'Trình định dạng', th: 'ตัวจัดรูปแบบ', sv: 'Formaterare' },
  encoder: { ar: 'مشفّر', es: 'Codificador', fr: 'Encodeur', de: 'Kodierer', ru: 'Кодировщик', zh: '编码器', hi: 'एन्कोडर', id: 'Enkoder', ur: 'انکوڈر', ja: 'エンコーダー', pt: 'Codificador', it: 'Codificatore', ko: '인코더', nl: 'Encoder', pl: 'Koder', tr: 'Kodlayıcı', vi: 'Trình mã hóa', th: 'ตัวเข้ารหัส', sv: 'Kodare' },
  decoder: { ar: 'فك التشفير', es: 'Decodificador', fr: 'Décodeur', de: 'Dekodierer', ru: 'Декодировщик', zh: '解码器', hi: 'डीकोडर', id: 'Dekoder', ur: 'ڈیکوڈر', ja: 'デコーダー', pt: 'Decodificador', it: 'Decodificatore', ko: '디코더', nl: 'Decoder', pl: 'Dekoder', tr: 'Kod çözücü', vi: 'Trình giải mã', th: 'ตัวถอดรหัส', sv: 'Avkodare' },
  qr: { ar: 'QR', es: 'QR', fr: 'QR', de: 'QR', ru: 'QR', zh: '二维码', hi: 'QR', id: 'QR', ur: 'QR', ja: 'QR', pt: 'QR', it: 'QR', ko: 'QR', nl: 'QR', pl: 'QR', tr: 'QR', vi: 'QR', th: 'QR', sv: 'QR' },
  json: { ar: 'JSON', es: 'JSON', fr: 'JSON', de: 'JSON', ru: 'JSON', zh: 'JSON', hi: 'JSON', id: 'JSON', ur: 'JSON', ja: 'JSON', pt: 'JSON', it: 'JSON', ko: 'JSON', nl: 'JSON', pl: 'JSON', tr: 'JSON', vi: 'JSON', th: 'JSON', sv: 'JSON' },
  ai: { ar: 'ذكاء اصطناعي', es: 'IA', fr: 'IA', de: 'KI', ru: 'ИИ', zh: '人工智能', hi: 'एआई', id: 'AI', ur: 'اے آئی', ja: 'AI', pt: 'IA', it: 'IA', ko: 'AI', nl: 'AI', pl: 'AI', tr: 'YZ', vi: 'AI', th: 'AI', sv: 'AI' },
  effects: { ar: 'تأثيرات', es: 'Efectos', fr: 'Effets', de: 'Effekte', ru: 'Эффекты', zh: '效果', hi: 'प्रभाव', id: 'Efek', ur: 'اثرات', ja: 'エフェクト', pt: 'Efeitos', it: 'Effetti', ko: '효과', nl: 'Effecten', pl: 'Efekty', tr: 'Efektler', vi: 'Hiệu ứng', th: 'เอฟเฟกต์', sv: 'Effekter' },
  exif: { ar: 'EXIF', es: 'EXIF', fr: 'EXIF', de: 'EXIF', ru: 'EXIF', zh: 'EXIF', hi: 'EXIF', id: 'EXIF', ur: 'EXIF', ja: 'EXIF', pt: 'EXIF', it: 'EXIF', ko: 'EXIF', nl: 'EXIF', pl: 'EXIF', tr: 'EXIF', vi: 'EXIF', th: 'EXIF', sv: 'EXIF' },
  passport: { ar: 'جواز السفر', es: 'Pasaporte', fr: 'Passeport', de: 'Pass', ru: 'Паспорт', zh: '护照', hi: 'पासपोर्ट', id: 'Paspor', ur: 'پاسپورٹ', ja: 'パスポート', pt: 'Passaporte', it: 'Passaporto', ko: '여권', nl: 'Paspoort', pl: 'Paszport', tr: 'Pasaport', vi: 'Hộ chiếu', th: 'หนังสือเดินทาง', sv: 'Pass' },
  meme: { ar: 'ميم', es: 'Meme', fr: 'Mème', de: 'Meme', ru: 'Мем', zh: '表情包', hi: 'मीम', id: 'Meme', ur: 'میم', ja: 'ミーム', pt: 'Meme', it: 'Meme', ko: '밈', nl: 'Meme', pl: 'Mem', tr: 'Meme', vi: 'Meme', th: 'มีม', sv: 'Meme' },
  collage: { ar: 'كولاج', es: 'Collage', fr: 'Collage', de: 'Collage', ru: 'Коллаж', zh: '拼贴', hi: 'कोलाज', id: 'Kolase', ur: 'کولاج', ja: 'コラージュ', pt: 'Colagem', it: 'Collage', ko: '콜라주', nl: 'Collage', pl: 'Kolaż', tr: 'Kolaj', vi: 'Ảnh ghép', th: 'คอลลาจ', sv: 'Kollage' },
  mockup: { ar: 'نموذج', es: 'Maqueta', fr: 'Maquette', de: 'Mockup', ru: 'Макет', zh: '样机', hi: 'मॉकअप', id: 'Mockup', ur: 'ماک اپ', ja: 'モックアップ', pt: 'Mockup', it: 'Mockup', ko: '목업', nl: 'Mockup', pl: 'Makieta', tr: 'Mockup', vi: 'Mockup', th: 'ม็อกอัป', sv: 'Mockup' },
};

function tokenize(value: string): string[] {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
}

function fallbackTitle(locale: Locale, category: 'Images' | 'AI' | 'Other'): string {
  const label = CATEGORY_LABELS[locale][category];
  const templates: Record<Locale, string> = {
    en: `Tool ${label}`, ar: `أداة ${label}`, es: `Herramienta de ${label}`, fr: `Outil ${label}`, de: `${label}-Tool`, ru: `Инструмент: ${label}`, zh: `${label}工具`, hi: `${label} टूल`, id: `Alat ${label}`, ur: `${label} ٹول`, ja: `${label}ツール`, pt: `Ferramenta de ${label}`, it: `Strumento ${label}`, ko: `${label} 도구`, nl: `${label}-tool`, pl: `Narzędzie ${label}`, tr: `${label} aracı`, vi: `Công cụ ${label}`, th: `เครื่องมือ${label}`, sv: `${label}-verktyg`,
  };
  return templates[locale];
}

export function localizeToolCategory(locale: Locale, category: 'Images' | 'AI' | 'Other'): string {
  return CATEGORY_LABELS[locale][category];
}

export function localizeToolTitle(locale: Locale, title: string, category: 'Images' | 'AI' | 'Other'): string {
  if (locale === 'en') return title;
  const parts = tokenize(title);
  const translated = parts.map((part) => TERMS[part.toLowerCase()]?.[locale] ?? (/^[A-Z0-9]{2,8}$/.test(part) ? part : ''));
  return translated.length > 0 && translated.every(Boolean) ? translated.join(' ') : fallbackTitle(locale, category);
}

export function localizeToolDescription(locale: Locale, title: string, category: 'Images' | 'AI' | 'Other'): string {
  const localizedTitle = localizeToolTitle(locale, title, category);
  const templates: Record<Locale, string> = {
    en: `Use ${localizedTitle} in FLIXO directly in your browser.`,
    ar: `استخدم ${localizedTitle} من FLIXO مباشرة داخل المتصفح.`,
    es: `Usa ${localizedTitle} de FLIXO directamente en tu navegador.`,
    fr: `Utilisez ${localizedTitle} de FLIXO directement dans votre navigateur.`,
    de: `Nutzen Sie ${localizedTitle} von FLIXO direkt im Browser.`,
    ru: `Используйте ${localizedTitle} от FLIXO прямо в браузере.`,
    zh: `直接在浏览器中使用 FLIXO 的${localizedTitle}。`,
    hi: `FLIXO के ${localizedTitle} का उपयोग सीधे ब्राउज़र में करें।`,
    id: `Gunakan ${localizedTitle} dari FLIXO langsung di browser.`,
    ur: `FLIXO کا ${localizedTitle} براہِ راست براؤزر میں استعمال کریں۔`,
    ja: `FLIXO の${localizedTitle}をブラウザで直接利用できます。`,
    pt: `Use ${localizedTitle} da FLIXO diretamente no navegador.`,
    it: `Usa ${localizedTitle} di FLIXO direttamente nel browser.`,
    ko: `브라우저에서 FLIXO의 ${localizedTitle}을(를) 바로 사용하세요.`,
    nl: `Gebruik ${localizedTitle} van FLIXO direct in je browser.`,
    pl: `Używaj ${localizedTitle} FLIXO bezpośrednio w przeglądarce.`,
    tr: `FLIXO ${localizedTitle} aracını doğrudan tarayıcıda kullanın.`,
    vi: `Sử dụng ${localizedTitle} của FLIXO ngay trong trình duyệt.`,
    th: `ใช้ ${localizedTitle} ของ FLIXO ได้โดยตรงในเบราว์เซอร์`,
    sv: `Använd FLIXO:s ${localizedTitle} direkt i webbläsaren.`,
  };
  return templates[locale];
}
