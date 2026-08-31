import { LOCALES, normalizeLocale, type CanonicalLocale } from './config';
import { getLocalizedToolTitle } from '../seo/tool-seo';

type LocaleMap = Partial<Record<CanonicalLocale, string>>;

const UI: Readonly<Record<string, LocaleMap>> = {
  'Local processing': { ar: 'معالجة محلية', es: 'Procesamiento local', fr: 'Traitement local', de: 'Lokale Verarbeitung', hi: 'स्थानीय प्रोसेसिंग', id: 'Pemrosesan lokal', it: 'Elaborazione locale', ja: 'ローカル処理', ko: '로컬 처리', ms: 'Pemprosesan setempat', nl: 'Lokale verwerking', pl: 'Przetwarzanie lokalne', pt: 'Processamento local', ru: 'Локальная обработка', sv: 'Lokal bearbetning', th: 'การประมวลผลในเครื่อง', tr: 'Yerel işleme', uk: 'Локальна обробка', vi: 'Xử lý cục bộ' },
  'Choose a file': { ar: 'اختر ملفًا', es: 'Elige un archivo', fr: 'Choisissez un fichier', de: 'Datei auswählen', hi: 'फ़ाइल चुनें', id: 'Pilih file', it: 'Scegli un file', ja: 'ファイルを選択', ko: '파일 선택', ms: 'Pilih fail', nl: 'Kies een bestand', pl: 'Wybierz plik', pt: 'Escolha um ficheiro', ru: 'Выберите файл', sv: 'Välj en fil', th: 'เลือกไฟล์', tr: 'Bir dosya seçin', uk: 'Виберіть файл', vi: 'Chọn tệp' },
  'Select PDF': { ar: 'اختر ملف PDF', es: 'Selecciona un PDF', fr: 'Sélectionnez un PDF', de: 'PDF auswählen', hi: 'PDF चुनें', id: 'Pilih PDF', it: 'Seleziona PDF', ja: 'PDFを選択', ko: 'PDF 선택', ms: 'Pilih PDF', nl: 'Selecteer PDF', pl: 'Wybierz PDF', pt: 'Selecione PDF', ru: 'Выберите PDF', sv: 'Välj PDF', th: 'เลือก PDF', tr: 'PDF seçin', uk: 'Виберіть PDF', vi: 'Chọn PDF' },
  Optional: { ar: 'اختياري', es: 'Opcional', fr: 'Facultatif', de: 'Optional', hi: 'वैकल्पिक', id: 'Opsional', it: 'Opzionale', ja: '任意', ko: '선택 사항', ms: 'Pilihan', nl: 'Optioneel', pl: 'Opcjonalne', pt: 'Opcional', ru: 'Необязательно', sv: 'Valfritt', th: 'ไม่บังคับ', tr: 'İsteğe bağlı', uk: 'Необов’язково', vi: 'Tùy chọn' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Tool ausführen', hi: 'टूल चलाएँ', id: 'Jalankan alat', it: 'Esegui lo strumento', ja: 'ツールを実行', ko: '도구 실행', ms: 'Jalankan alat', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', pt: 'Executar ferramenta', ru: 'Запустить инструмент', sv: 'Kör verktyget', th: 'เรียกใช้เครื่องมือ', tr: 'Aracı çalıştır', uk: 'Запустити інструмент', vi: 'Chạy công cụ' },
  'Compress image': { ar: 'ضغط الصورة', es: 'Comprimir imagen', fr: 'Compresser l’image', de: 'Bild komprimieren', hi: 'छवि संपीड़ित करें', id: 'Kompres gambar', it: 'Comprimi immagine', ja: '画像を圧縮', ko: '이미지 압축', ms: 'Mampatkan imej', nl: 'Afbeelding comprimeren', pl: 'Kompresuj obraz', pt: 'Comprimir imagem', ru: 'Сжать изображение', sv: 'Komprimera bilden', th: 'บีบอัดรูปภาพ', tr: 'Görseli sıkıştır', uk: 'Стиснути зображення', vi: 'Nén hình ảnh' },
  'Compress all to ZIP': { ar: 'ضغط الكل إلى ZIP', es: 'Comprimir todo en ZIP', fr: 'Tout compresser en ZIP', de: 'Alles als ZIP komprimieren', hi: 'सबको ZIP में संपीड़ित करें', id: 'Kompres semua ke ZIP', it: 'Comprimi tutto in ZIP', ja: 'すべてをZIPに圧縮', ko: '모두 ZIP으로 압축', ms: 'Mampatkan semua ke ZIP', nl: 'Alles naar ZIP comprimeren', pl: 'Skompresuj wszystko do ZIP', pt: 'Comprimir tudo em ZIP', ru: 'Сжать всё в ZIP', sv: 'Komprimera allt till ZIP', th: 'บีบอัดทั้งหมดเป็น ZIP', tr: 'Tümünü ZIP olarak sıkıştır', uk: 'Стиснути все в ZIP', vi: 'Nén tất cả thành ZIP' },
  'Original text': { ar: 'النص الأصلي', es: 'Texto original', fr: 'Texte original', de: 'Originaltext', hi: 'मूल टेक्स्ट', id: 'Teks asli', it: 'Testo originale', ja: '元のテキスト', ko: '원본 텍스트', ms: 'Teks asal', nl: 'Originele tekst', pl: 'Tekst oryginalny', pt: 'Texto original', ru: 'Исходный текст', sv: 'Originaltext', th: 'ข้อความต้นฉบับ', tr: 'Özgün metin', uk: 'Оригінальний текст', vi: 'Văn bản gốc' },
  'Modified text': { ar: 'النص المعدّل', es: 'Texto modificado', fr: 'Texte modifié', de: 'Geänderter Text', hi: 'संशोधित टेक्स्ट', id: 'Teks yang diubah', it: 'Testo modificato', ja: '変更後のテキスト', ko: '수정된 텍스트', ms: 'Teks diubah suai', nl: 'Aangepaste tekst', pl: 'Zmodyfikowany tekst', pt: 'Texto modificado', ru: 'Изменённый текст', sv: 'Ändrad text', th: 'ข้อความที่แก้ไข', tr: 'Değiştirilmiş metin', uk: 'Змінений текст', vi: 'Văn bản đã sửa' },
  Compare: { ar: 'مقارنة', es: 'Comparar', fr: 'Comparer', de: 'Vergleichen', hi: 'तुलना करें', id: 'Bandingkan', it: 'Confronta', ja: '比較', ko: '비교', ms: 'Bandingkan', nl: 'Vergelijken', pl: 'Porównaj', pt: 'Comparar', ru: 'Сравнить', sv: 'Jämför', th: 'เปรียบเทียบ', tr: 'Karşılaştır', uk: 'Порівняти', vi: 'So sánh' },
  'Copy text': { ar: 'نسخ النص', es: 'Copiar texto', fr: 'Copier le texte', de: 'Text kopieren', hi: 'टेक्स्ट कॉपी करें', id: 'Salin teks', it: 'Copia testo', ja: 'テキストをコピー', ko: '텍스트 복사', ms: 'Salin teks', nl: 'Tekst kopiëren', pl: 'Kopiuj tekst', pt: 'Copiar texto', ru: 'Копировать текст', sv: 'Kopiera text', th: 'คัดลอกข้อความ', tr: 'Metni kopyala', uk: 'Копіювати текст', vi: 'Sao chép văn bản' },
};

const PREFIXES: ReadonlyArray<readonly [string, LocaleMap]> = [
  ['Download ', { ar: 'تنزيل ', es: 'Descargar ', fr: 'Télécharger ', de: 'Herunterladen ', hi: 'डाउनलोड ', id: 'Unduh ', it: 'Scarica ', ja: 'ダウンロード ', ko: '다운로드 ', ms: 'Muat turun ', nl: 'Downloaden ', pl: 'Pobierz ', pt: 'Baixar ', ru: 'Скачать ', sv: 'Ladda ner ', th: 'ดาวน์โหลด ', tr: 'İndir ', uk: 'Завантажити ', vi: 'Tải xuống ' }],
  ['Input: ', { ar: 'الإدخال: ', es: 'Entrada: ', fr: 'Entrée : ', de: 'Eingabe: ', hi: 'इनपुट: ', id: 'Input: ', it: 'Input: ', ja: '入力: ', ko: '입력: ', ms: 'Input: ', nl: 'Invoer: ', pl: 'Wejście: ', pt: 'Entrada: ', ru: 'Вход: ', sv: 'Indata: ', th: 'อินพุต: ', tr: 'Girdi: ', uk: 'Вхід: ', vi: 'Đầu vào: ' }],
  ['Output: ', { ar: 'الإخراج: ', es: 'Salida: ', fr: 'Sortie : ', de: 'Ausgabe: ', hi: 'आउटपुट: ', id: 'Keluaran: ', it: 'Output: ', ja: '出力: ', ko: '출력: ', ms: 'Keluaran: ', nl: 'Uitvoer: ', pl: 'Wyjście: ', pt: 'Saída: ', ru: 'Результат: ', sv: 'Utdata: ', th: 'เอาต์พุต: ', tr: 'Çıktı: ', uk: 'Вихід: ', vi: 'Đầu ra: ' }],
];

function translateValue(locale: CanonicalLocale, value: string): string {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const exact = UI[trimmed]?.[locale];
  if (exact) return value.replace(trimmed, exact);
  for (const [prefix, map] of PREFIXES) {
    if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  }
  return value;
}

function shouldSkip(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]'));
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
    const next = translateValue(locale, current);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translateValue(locale, current);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
  const firstHeading = root.querySelector<HTMLElement>('h1');
  if (firstHeading) {
    const title = getLocalizedToolTitle(locale, toolId, firstHeading.textContent?.trim() || toolId);
    if (title && firstHeading.textContent !== title) firstHeading.textContent = title;
  }
}

export function installToolUiRuntimeCompleteness(): () => void {
  const apply = () => {
    const rawLocale = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
    const locale = normalizeLocale(rawLocale);
    if (!LOCALES.includes(locale) || locale === 'en') return;
    const root = document.querySelector<HTMLElement>('.tool-page-modern, .tool-shell, main');
    if (!root) return;
    const toolId = root.getAttribute('data-tool-id') ?? document.body.getAttribute('data-tool-id') ?? '';
    root.lang = locale;
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
