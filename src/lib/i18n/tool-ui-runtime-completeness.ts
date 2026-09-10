import { LOCALES, normalizeLocale, type CanonicalLocale } from './config';
import { getLocalizedToolTitle } from '../seo/tool-seo';

type LocaleMap = Partial<Record<CanonicalLocale, string>>;

const UI: Readonly<Record<string, LocaleMap>> = {
  'Local processing': { ar: 'معالجة محلية', es: 'Procesamiento local', fr: 'Traitement local', de: 'Lokale Verarbeitung', hi: 'स्थानीय प्रोसेसिंग', id: 'Pemrosesan lokal', it: 'Elaborazione locale', ja: 'ローカル処理', ko: '로컬 처리', ms: 'Pemprosesan setempat', nl: 'Lokale verwerking', pl: 'Przetwarzanie lokalne', pt: 'Processamento local', ru: 'Локальная обработка', sv: 'Lokal bearbetning', th: 'การประมวลผลในเครื่อง', tr: 'Yerel işleme', uk: 'Локальна обробка', vi: 'Xử lý cục bộ' },
  'Choose a file': { ar: 'اختر ملفًا', es: 'Elige un archivo', fr: 'Choisissez un fichier', de: 'Datei auswählen', hi: 'फ़ाइल चुनें', id: 'Pilih file', it: 'Scegli un file', ja: 'ファイルを選択', ko: '파일 선택', ms: 'Pilih fail', nl: 'Kies een bestand', pl: 'Wybierz plik', pt: 'Escolha um ficheiro', ru: 'Выберите файл', sv: 'Välj en fil', th: 'เลือกไฟล์', tr: 'Bir dosya seçin', uk: 'Виберіть файл', vi: 'Chọn tệp' },
  'Select PDF': { ar: 'اختر ملف PDF', es: 'Selecciona un PDF', fr: 'Sélectionnez un PDF', de: 'PDF auswählen', hi: 'PDF चुनें', id: 'Pilih PDF', it: 'Seleziona PDF', ja: 'PDFを選択', ko: 'PDF 선택', ms: 'Pilih PDF', nl: 'Selecteer PDF', pl: 'Wybierz PDF', pt: 'Selecione PDF', ru: 'Выберите PDF', sv: 'Välj PDF', th: 'เลือก PDF', tr: 'PDF seçin', uk: 'Виберіть PDF', vi: 'Chọn PDF' },
  Optional: { ar: 'اختياري', es: 'Opcional', fr: 'Facultatif', de: 'Optional', hi: 'वैकल्पिक', id: 'Opsional', it: 'Opzionale', ja: '任意', ko: '선택 사항', ms: 'Pilihan', nl: 'Optioneel', pl: 'Opcjonalne', pt: 'Opcional', ru: 'Необязательно', sv: 'Valfritt', th: 'ไม่บังคับ', tr: 'İsteğe bağlı', uk: 'Необов’язково', vi: 'Tùy chọn' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Tool ausführen', hi: 'टूल चलाएँ', id: 'Jalankan alat', it: 'Esegui lo strumento', ja: 'ツールを実行', ko: '도구를 실행', ms: 'Jalankan alat', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', pt: 'Executar ferramenta', ru: 'Запустить инструмент', sv: 'Kör verktyget', th: 'เรียกใช้เครื่องมือ', tr: 'Aracı çalıştır', uk: 'Запустити інструмент', vi: 'Chạy công cụ' },
  'Compress image': { ar: 'ضغط الصورة', es: 'Comprimir imagen', fr: 'Compresser l’image', de: 'Bild komprimieren', hi: 'छवि संपीड़ित करें', id: 'Kompres gambar', it: 'Comprimi immagine', ja: '画像を圧縮', ko: '이미지 압축', ms: 'Mampatkan imej', nl: 'Afbeelding comprimeren', pl: 'Kompresuj obraz', pt: 'Comprimir imagem', ru: 'Сжать изображение', sv: 'Komprimera bilden', th: 'บีบอัดรูปภาพ', tr: 'Görseli sıkıştır', uk: 'Стиснути зображення', vi: 'Nén hình ảnh' },
  'Compress all to ZIP': { ar: 'ضغط الكل إلى ZIP', es: 'Comprimir todo en ZIP', fr: 'Tout compresser en ZIP', de: 'Alles als ZIP komprimieren', hi: 'सबको ZIP में संपीड़ित करें', id: 'Kompres semua ke ZIP', it: 'Comprimi tutto in ZIP', ja: 'すべてをZIPに圧縮', ko: '모두 ZIP으로 압축', ms: 'Mampatkan semua ke ZIP', nl: 'Alles naar ZIP comprimeren', pl: 'Skompresuj wszystko do ZIP', pt: 'Comprimir tudo em ZIP', ru: 'Сжать всё в ZIP', sv: 'Komprimera allt till ZIP', th: 'บีบอัดทั้งหมดเป็น ZIP', tr: 'Tümünü ZIP olarak sıkıştır', uk: 'Стиснути все в ZIP', vi: 'Nén tất cả thành ZIP' },
  'Original text': { ar: 'النص الأصلي', es: 'Texto original', fr: 'Texte original', de: 'Originaltext', hi: 'मूल टेक्स्ट', id: 'Teks asli', it: 'Testo originale', ja: '元のテキスト', ko: '원본 텍스트', ms: 'Teks asal', nl: 'Originele tekst', pl: 'Tekst oryginalny', pt: 'Texto original', ru: 'Исходный текст', sv: 'Originaltext', th: 'ข้อความต้นฉบับ', tr: 'Özgün metin', uk: 'Оригінальний текст', vi: 'Văn bản gốc' },
  'Modified text': { ar: 'النص المعدّل', es: 'Texto modificado', fr: 'Texte modifié', de: 'Geänderter Text', hi: 'संशोधित टेक्स्ट', id: 'Teks yang diubah', it: 'Testo modificato', ja: '変更後のテキスト', ko: '수정된 텍스트', ms: 'Teks diubah suai', nl: 'Aangepaste tekst', pl: 'Zmodyfikowany tekst', pt: 'Texto modificado', ru: 'Изменённый текст', sv: 'Ändrad text', th: 'ข้อความที่แก้ไข', tr: 'Değiştirilmiş metin', uk: 'Змінений текст', vi: 'Văn bản đã sửa' },
  Compare: { ar: 'مقارنة', es: 'Comparar', fr: 'Comparer', de: 'Vergleichen', hi: 'तुलना करें', id: 'Bandingkan', it: 'Confronta', ja: '比較', ko: '비교', ms: 'Bandingkan', nl: 'Vergelijken', pl: 'Porównaj', pt: 'Comparar', ru: 'Сравнить', sv: 'Jämför', th: 'เปรียบเทียบ', tr: 'Karşılaştır', uk: 'Порівняти', vi: 'So sánh' },
  'Copy text': { ar: 'نسخ النص', es: 'Copiar texto', fr: 'Copier le texte', de: 'Text kopieren', hi: 'टेक्स्ट कॉपी करें', id: 'Salin teks', it: 'Copia testo', ja: 'テキストをコピー', ko: '텍스트 복사', ms: 'Salin teks', nl: 'Tekst kopiëren', pl: 'Kopiuj tekst', pt: 'Copiar texto', ru: 'Копировать текст', sv: 'Kopiera text', th: 'คัดลอกข้อความ', tr: 'Metni kopyala', uk: 'Копіювати текст', vi: 'Sao chép văn bản' },
  Open: { ar: 'فتح', es: 'Abrir', fr: 'Ouvrir', de: 'Öffnen', hi: 'खोलें', id: 'Buka', it: 'Apri', ja: '開く', ko: '열기', ms: 'Buka', nl: 'Openen', pl: 'Otwórz', pt: 'Abrir', ru: 'Открыть', sv: 'Öppna', th: 'เปิด', tr: 'Aç', uk: 'Відкрити', vi: 'Mở' },
  Images: { ar: 'الصور', es: 'Imágenes', fr: 'Images', de: 'Bilder', hi: 'छवियाँ', id: 'Gambar', it: 'Immagini', ja: '画像', ko: '이미지', ms: 'Imej', nl: 'Afbeeldingen', pl: 'Obrazy', pt: 'Imagens', ru: 'Изображения', sv: 'Bilder', th: 'รูปภาพ', tr: 'Görseller', uk: 'Зображення', vi: 'Hình ảnh' },
  Privacy: { ar: 'الخصوصية', es: 'Privacidad', fr: 'Confidentialité', de: 'Datenschutz', hi: 'गोपनीयता', id: 'Privasi', it: 'Privacy', ja: 'プライバシー', ko: '개인정보 보호', ms: 'Privasi', nl: 'Privacy', pl: 'Prywatność', pt: 'Privacidade', ru: 'Конфиденциальность', sv: 'Integritet', th: 'ความเป็นส่วนตัว', tr: 'Gizlilik', uk: 'Конфіденційність', vi: 'Quyền riêng tư' },
  Auto: { ar: 'تلقائي', es: 'Automático', fr: 'Automatique', de: 'Automatisch', hi: 'स्वचालित', id: 'Otomatis', it: 'Automatico', ja: '自動', ko: '자동', ms: 'Automatik', nl: 'Automatisch', pl: 'Automatycznie', pt: 'Automático', ru: 'Авто', sv: 'Automatiskt', th: 'อัตโนมัติ', tr: 'Otomatik', uk: 'Автоматично', vi: 'Tự động' },
  'Generate image': { ar: 'إنشاء صورة', es: 'Generar imagen', fr: 'Générer une image', de: 'Bild generieren', hi: 'छवि बनाएं', id: 'Buat gambar', it: 'Genera immagine', ja: '画像を生成', ko: '이미지 생성', ms: 'Jana imej', nl: 'Afbeelding genereren', pl: 'Wygeneruj obraz', pt: 'Gerar imagem', ru: 'Сгенерировать изображение', sv: 'Skapa bild', th: 'สร้างภาพ', tr: 'Görsel oluştur', uk: 'Створити зображення', vi: 'Tạo hình ảnh' },
  'Watermark text': { ar: 'نص العلامة المائية', es: 'Texto de marca de agua', fr: 'Texte du filigrane', de: 'Wasserzeichentext', hi: 'वॉटरमार्क टेक्स्ट', id: 'Teks tanda air', it: 'Testo filigrana', ja: '透かしテキスト', ko: '워터마크 텍스트', ms: 'Teks tanda air', nl: 'Watermerktekst', pl: 'Tekst znaku wodnego', pt: 'Texto da marca d’água', ru: 'Текст водяного знака', sv: 'Vattenstämpeltext', th: 'ข้อความลายน้ำ', tr: 'Filigran metni', uk: 'Текст водяного знака', vi: 'Văn bản hình mờ' },
  'Top text': { ar: 'النص العلوي', es: 'Texto superior', fr: 'Texte supérieur', de: 'Oberer Text', hi: 'ऊपरी टेक्स्ट', id: 'Teks atas', it: 'Testo superiore', ja: '上部テキスト', ko: '상단 텍스트', ms: 'Teks atas', nl: 'Bovenste text', pl: 'Górny tekst', pt: 'Texto superior', ru: 'Верхний текст', sv: 'Övre text', th: 'ข้อความด้านบน', tr: 'Üst metin', uk: 'Верхній текст', vi: 'Văn bản trên' },
  'Bottom text': { ar: 'النص السفلي', es: 'Texto inferior', fr: 'Texte inférieur', de: 'Unterer Text', hi: 'निचला टेक्स्ट', id: 'Teks bawah', it: 'Testo inferiore', ja: '下部テキスト', ko: '하단 텍스트', ms: 'Teks bawah', nl: 'Onderste tekst', pl: 'Dolny tekst', pt: 'Texto inferior', ru: 'Нижний текст', sv: 'Nedre text', th: 'ข้อความด้านล่าง', tr: 'Alt metin', uk: 'Нижній текст', vi: 'Văn bản dưới' },
  Brightness: { ar: 'السطوع', es: 'Brillo', fr: 'Luminosité', de: 'Helligkeit', hi: 'चमक', id: 'Kecerahan', it: 'Luminosità', ja: '明るさ', ko: '밝기', ms: 'Kecerahan', nl: 'Helderheid', pl: 'Jasność', pt: 'Brilho', ru: 'Яркость', sv: 'Ljusstyrka', th: 'ความสว่าง', tr: 'Parlaklık', uk: 'Яскравість', vi: 'Độ sáng' },
  Contrast: { ar: 'التباين', es: 'Contraste', fr: 'Contraste', de: 'Kontrast', hi: 'कंट्रास्ट', id: 'Kontras', it: 'Contrasto', ja: 'コントラスト', ko: '대비', ms: 'Kontras', nl: 'Contrast', pl: 'Kontrast', pt: 'Contraste', ru: 'Контраст', sv: 'Kontrast', th: 'คอนทราสต์', tr: 'Kontrast', uk: 'Контраст', vi: 'Độ tương phản' },
  Saturation: { ar: 'التشبع', es: 'Saturación', fr: 'Saturation', de: 'Sättigung', hi: 'संतृप्ति', id: 'Saturasi', it: 'Saturazione', ja: '彩度', ko: '채도', ms: 'Ketepuan', nl: 'Verzadiging', pl: 'Nasycenie', pt: 'Saturação', ru: 'Насыщенность', sv: 'Mättnad', th: 'ความอิ่มตัว', tr: 'Doygunluk', uk: 'Насиченість', vi: 'Độ bão hòa' },
  Grayscale: { ar: 'تدرج رمادي', es: 'Escala de grises', fr: 'Niveaux de gris', de: 'Graustufen', hi: 'ग्रेस्केल', id: 'Skala abu-abu', it: 'Scala di grigi', ja: 'グレースケール', ko: '그레이스케일', ms: 'Skala kelabu', nl: 'Grijstinten', pl: 'Skala szarości', pt: 'Escala de cinza', ru: 'Оттенки серого', sv: 'Gråskala', th: 'โทนสีเทา', tr: 'Gri tonlama', uk: 'Відтінки сірого', vi: 'Thang độ xám' },
  'Image compression tool': { ar: 'أداة ضغط الصور', es: 'Herramienta de compresión de imágenes', fr: 'Outil de compression d’images', de: 'Bildkomprimierungstool', hi: 'छवि संपीड़न टूल', id: 'Alat kompresi gambar', it: 'Strumento di compressione immagini', ja: '画像圧縮ツール', ko: '이미지 압축 도구', ms: 'Alat pemampatan imej', nl: 'Hulpmiddel voor beeldcompressie', pl: 'Narzędzie do kompresji obrazów', pt: 'Ferramenta de compressão de imagens', ru: 'Инструмент сжатия изображений', sv: 'Verktyg för bildkomprimering', th: 'เครื่องมือบีบอัดรูปภาพ', tr: 'Görüntü sıkıştırma aracı', uk: 'Інструмент стиснення зображень', vi: 'Công cụ nén ảnh' },
  Quality: { ar: 'الجودة', es: 'Calidad', fr: 'Qualité', de: 'Qualität', hi: 'गुणवत्ता', id: 'Kualitas', it: 'Qualità', ja: '品質', ko: '품질', ms: 'Kualiti', nl: 'Kwaliteit', pl: 'Jakość', pt: 'Qualidade', ru: 'Качество', sv: 'Kvalitet', th: 'คุณภาพ', tr: 'Kalite', uk: 'Якість', vi: 'Chất lượng' },
  'A cinematic sunset over Cairo...': { ar: 'غروب سينمائي فوق القاهرة...', es: 'Una puesta de sol cinematográfica sobre El Cairo...', fr: 'Un coucher de soleil cinématographique sur Le Caire...', de: 'Ein filmischer Sonnenuntergang über Kairo...', hi: 'काहिरा के ऊपर एक सिनेमाई सूर्यास्त...', id: 'Matahari terbenam sinematik di atas Kairo...', it: 'Un tramonto cinematografico sul Cairo...', ja: 'カイロの上空に広がる映画のような夕焼け...', ko: '카이로 위의 영화 같은 노을...', ms: 'Matahari terbenam sinematik di atas Kaherah...', nl: 'Een filmische zonsondergang boven Caïro...', pl: 'Filmowy zachód słońca nad Kairem...', pt: 'Um pôr do sol cinematográfico sobre o Cairo...', ru: 'Кинематографичный закат над Каиром...', sv: 'En filmisk solnedgång över Kairo...', th: 'พระอาทิตย์ตกเหนือกรุงไคโรในบรรยากาศแบบภาพยนตร์...', tr: 'Kahire üzerinde sinematik bir gün batımı...', uk: 'Кінематографічний захід сонця над Каїром...', vi: 'Hoàng hôn điện ảnh trên Cairo...' },
};

const PREFIXES: ReadonlyArray<readonly [string, LocaleMap]> = [
  ['Download ', { ar: 'تنزيل ', es: 'Descargar ', fr: 'Télécharger ', de: 'Herunterladen ', hi: 'डाउनलोड ', id: 'Unduh ', it: 'Scarica ', ja: 'ダウンロード ', ko: '다운로드 ', ms: 'Muat turun ', nl: 'Downloaden ', pl: 'Pobierz ', pt: 'Baixar ', ru: 'Скачать ', sv: 'Ladda ner ', th: 'ดาวน์โหลด ', tr: 'İndir ', uk: 'Завантажити ', vi: 'Tải xuống ' }],
  ['Input: ', { ar: 'الإدخال: ', es: 'Entrada: ', fr: 'Entrée : ', de: 'Eingabe: ', hi: 'इनपुट: ', id: 'Input: ', it: 'Input: ', ja: '入力: ', ko: '입력: ', ms: 'Input: ', nl: 'Invoer: ', pl: 'Wejście: ', pt: 'Entrada: ', ru: 'Вход: ', sv: 'Indata: ', th: 'อินพุต: ', tr: 'Girdi: ', uk: 'Вхід: ', vi: 'Đầu vào: ' }],
  ['Output: ', { ar: 'الإخراج: ', es: 'Salida: ', fr: 'Sortie : ', de: 'Ausgabe: ', hi: 'आउटपुट: ', id: 'Keluaran: ', it: 'Output: ', ja: '出力: ', ko: '출력: ', ms: 'Keluaran: ', nl: 'Uitvoer: ', pl: 'Wyjście: ', pt: 'Saída: ', ru: 'Результат: ', sv: 'Utdata: ', th: 'เอาต์พุต: ', tr: 'Çıktı: ', uk: 'Вихід: ', vi: 'Đầu ra: ' }],
];

const TOOL_TITLE_KEYS = new Set(['AI Image Generator', 'Background Remover', 'Image Upscaler', 'Image Converter', 'Image to Text OCR', 'Object Remover', 'Crop & Resize', 'Watermark Remover', 'Image Compressor', 'Meme Generator', 'Image Effects', 'Watermark Adder']);

export function translateValue(locale: CanonicalLocale, value: string, toolId: string): string {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const exact = UI[trimmed]?.[locale];
  if (exact) return value.replace(trimmed, exact);
  if (TOOL_TITLE_KEYS.has(trimmed) && toolId) {
    const localizedTitle = getLocalizedToolTitle(locale, toolId, trimmed);
    if (localizedTitle && localizedTitle !== trimmed) return value.replace(trimmed, localizedTitle);
  }
  for (const [prefix, map] of PREFIXES) {
    if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  }
  return value;
}

export function isAuthoritativeLocalizedUiValue(locale: CanonicalLocale, value: string, toolId = ''): boolean {
  if (locale === 'en') return true;
  const trimmed = value.trim();
  const exactMap = UI[trimmed];
  if (exactMap && Object.prototype.hasOwnProperty.call(exactMap, locale)) return exactMap[locale] === trimmed;
  if (TOOL_TITLE_KEYS.has(trimmed) && toolId) {
    return getLocalizedToolTitle(locale, toolId, trimmed) === trimmed;
  }
  for (const [prefix, map] of PREFIXES) {
    if (value.startsWith(prefix) && Object.prototype.hasOwnProperty.call(map, locale)) return map[locale] === prefix;
  }
  return false;
}

function shouldSkip(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]'));
}

function getToolId(root: HTMLElement): string {
  const fromRoot = root.getAttribute('data-tool-id') ?? document.body.getAttribute('data-tool-id');
  if (fromRoot) return fromRoot;
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments.length >= 2 && LOCALES.includes(normalizeLocale(segments[0])) ? segments[1] : '';
}

function localizeRoot(root: HTMLElement, locale: CanonicalLocale, toolId: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue?.trim() && !shouldSkip(node)) texts.push(node);
  }
  for (const node of texts) {
    const current = node.nodeValue ?? '';
    const next = translateValue(locale, current, toolId);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translateValue(locale, current, toolId);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
  const firstHeading = root.querySelector<HTMLElement>('h1');
  if (firstHeading) {
    const current = firstHeading.textContent?.trim() ?? '';
    const title = getLocalizedToolTitle(locale, toolId, current || toolId);
    if (title && current !== title) firstHeading.textContent = title;
  }
}

export function installToolUiRuntimeCompleteness(): () => void {
  const apply = () => {
    const rawLocale = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
    const locale = normalizeLocale(rawLocale);
    if (!LOCALES.includes(locale) || locale === 'en') return;
    const root = document.querySelector<HTMLElement>('.tool-page-modern, .tool-shell, main');
    if (!root) return;
    const toolId = getToolId(root);
    if (root.lang !== locale) root.lang = locale;
    localizeRoot(root, locale, toolId);
  };
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  };
  apply();
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
  const root = typeof document !== 'undefined' ? document.body : null;
  if (observer && root) observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer?.disconnect();
}
