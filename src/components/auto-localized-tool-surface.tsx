import { useEffect, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { LOCALE_METADATA } from '@/lib/i18n';
import { getLocalizedToolTitle } from '@/lib/seo/tool-seo';

type Props = Readonly<{ locale: Locale; toolId: string; children: ReactNode }>;
type LocaleMap = Partial<Record<Locale, string>>;

const P: Record<string, LocaleMap> = {
  'Choose an image': { ar: 'اختر صورة', es: 'Elige una imagen', fr: 'Choisissez une image', de: 'Bild auswählen', ru: 'Выберите изображение', zh: '选择图像', hi: 'एक छवि चुनें', id: 'Pilih gambar', ur: 'تصویر منتخب کریں', ja: '画像を選択', pt: 'Scegli un’immagine', it: 'Scegli un’immagine', ko: '이미지 선택', nl: 'Kies een afbeelding', pl: 'Wybierz obraz,', tr: 'Bir görsel seçin', vi: 'Chọn hình ảnh', th: 'เลือกภาพ', sv: 'Välj en bild' },
  Upload: { ar: 'رفع', es: 'Subir', fr: 'Importer', de: 'Hochladen', ru: 'Загрузить', zh: '上传', hi: 'अपलोड', id: 'Unggah', ur: 'اپ لوڈ', ja: 'アップロード', pt: 'Enviar', it: 'Carica', ko: '업로드', nl: 'Uploaden', pl: 'Prześlij', tr: 'Yükle', vi: 'Tải lên', th: 'อัปโหลด', sv: 'Ladda upp' },
  Download: { ar: 'تنزيل', es: 'Descargar', fr: 'Télécharger', de: 'Herunterladen', ru: 'Скачать', zh: '下载', hi: 'डाउनलोड', id: 'Unduh', ur: 'ڈاؤن لوڈ', ja: 'ダウンロード', pt: 'Baixar', it: 'Scarica', ko: '다운로드', nl: 'Downloaden', pl: 'Pobierz', tr: 'İndir', vi: 'Tải xuống', th: 'ดาวน์โหลด', sv: 'Ladda ner' },
  'Download now': { ar: 'تنزيل الآن', es: 'Descargar ahora', fr: 'Télécharger maintenant', de: 'Jetzt herunterladen', ru: 'Скачать сейчас', zh: '立即下载', hi: 'अभी डाउनलोड करें', id: 'Unduh sekarang', ur: 'اب ڈاؤن لوڈ کریں', ja: '今すぐダウンロード', pt: 'Baixar agora', it: 'Scarica ora', ko: '지금 다운로드', nl: 'Nu downloaden', pl: 'Pobierz teraz', tr: 'Şimdi indir', vi: 'Tải xuống ngay', th: 'ดาวน์โหลดตอนนี้', sv: 'Ladda ner nu' },
  'Download compressed WAV': { ar: 'تنزيل WAV المضغوط', es: 'Descargar WAV comprimido', fr: 'Télécharger le WAV compressé', de: 'Komprimiertes WAV herunterladen', ru: 'Скачать сжатый WAV', zh: '下载压缩 WAV', hi: 'संपीड़ित WAV डाउनलोड करें', id: 'Unduh WAV terkompresi', ur: 'کمپریس شدہ WAV ڈاؤن لوڈ کریں', ja: '圧縮 WAV をダウンロード', pt: 'Baixar WAV compactado', it: 'Scarica WAV compresso', ko: '압축 WAV 다운로드', nl: 'Gecomprimeerde WAV downloaden', pl: 'Pobierz skompresowany WAV', tr: 'Sıkıştırılmış WAV indir', vi: 'Tải WAV nén xuống', th: 'ดาวน์โหลด WAV ที่บีบอัด', sv: 'Ladda ner komprimerad WAV' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Werkzeug ausführen', ru: 'Запустить инструмент', zh: '运行工具', hi: 'टूल चलाएँ', id: 'Jalankan alat', ur: 'ٹول چلائیں', ja: 'ツールを実行', pt: 'Executar ferramenta', it: 'Esegui strumento', ko: '도구 실행', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', tr: 'Aracı çalıştır', vi: 'Chạy công cụ', th: 'เรียกใช้เครื่องมือ', sv: 'Kör verktyg' },
  'Processing…': { ar: 'جارٍ المعالجة…', es: 'Procesando…', fr: 'Traitement…', de: 'Verarbeitung…', ru: 'Обработка…', zh: '处理中…', hi: 'प्रोसेस हो रहा है…', id: 'Memproses…', ur: 'پروسیسنگ جاری ہے…', ja: '処理中…', pt: 'Processando…', it: 'Elaborazione…', ko: '처리 중…', nl: 'Verwerken…', pl: 'Przetwarzanie…', tr: 'İşleniyor…', vi: 'Đang xử lý…', th: 'กำลังประมวลผล…', sv: 'Bearbetar…' },
  'Compressing…': { ar: 'جارٍ الضغط…', es: 'Comprimiendo…', fr: 'Compression…', de: 'Wird komprimiert…', ru: 'Сжатие…', zh: '压缩中…', hi: 'कंप्रेस हो रहा है…', id: 'Mengompresi…', ur: 'کمپریس ہو رہا ہے…', ja: '圧縮中…', pt: 'Comprimindo…', it: 'Compressione…', ko: '압축 중…', nl: 'Comprimeren…', pl: 'Kompresowanie…', tr: 'Sıkıştırılıyor…', vi: 'Đang nén…', th: 'กำลังบีบอัด…', sv: 'Komprimerar…' },
  Processing: { ar: 'جارٍ المعالجة', es: 'Procesando', fr: 'Traitement', de: 'Verarbeitung', ru: 'Обработка', zh: '处理中', hi: 'प्रोसेस हो रहा है', id: 'Memproses', ur: 'پروسیسنگ', ja: '処理中', pt: 'Processando', it: 'Elaborazione', ko: '처리 중', nl: 'Verwerken', pl: 'Przetwarzanie', tr: 'İşleniyor', vi: 'Đang xử lý', th: 'กำลังประมวลผล', sv: 'Bearbetar' },
};

const PREFIXES: Array<[string, LocaleMap]> = [
  ['Download ', { ar: 'تنزيل ', es: 'Descargar ', fr: 'Télécharger ', de: 'Herunterladen ', ru: 'Скачать ', zh: '下载 ', hi: 'डाउनलोड ', id: 'Unduh ', ur: 'ڈاؤن لوڈ ', ja: 'ダウンロード ', pt: 'Baixar ', it: 'Scarica ', ko: '다운로드 ', nl: 'Downloaden ', pl: 'Pobierz ', tr: 'İndir ', vi: 'Tải xuống ', th: 'ดาวน์โหลด ', sv: 'Ladda ner ' }],
  ['Input: ', { ar: 'الإدخال: ', es: 'Entrada: ', fr: 'Entrée : ', de: 'Eingabe: ', ru: 'Вход: ', zh: '输入：', hi: 'इनपुट: ', id: 'Input: ', ur: 'ان پٹ: ', ja: '入力: ', pt: 'Entrada: ', it: 'Input: ', ko: '입력: ', nl: 'Invoer: ', pl: 'Wejście: ', tr: 'Girdi: ', vi: 'Đầu vào: ', th: 'อินพุต: ', sv: 'Indata: ' }],
  ['Output: ', { ar: 'الإخراج: ', es: 'Salida: ', fr: 'Sortie : ', de: 'Ausgabe: ', ru: 'Результат: ', zh: '输出：', hi: 'आउटपुट: ', id: 'Keluaran: ', ur: 'آؤٹ پٹ: ', ja: '出力: ', pt: 'Saída: ', it: 'Output: ', ko: '출력: ', nl: 'Uitvoer: ', pl: 'Wyjście: ', tr: 'Çıktı: ', vi: 'Đầu ra: ', th: 'เอาต์พุต: ', sv: 'Utdata: ' }],
  ['Size change: ', { ar: 'تغير الحجم: ', es: 'Cambio de tamaño: ', fr: 'Variation de taille : ', de: 'Größenänderung: ', ru: 'Изменение размера: ', zh: '大小变化：', hi: 'आकार परिवर्तन: ', id: 'Perubahan ukuran: ', ur: 'سائز میں تبدیلی: ', ja: 'サイズ変更: ', pt: 'Alteração de tamanho: ', it: 'Variazione dimensione: ', ko: '크기 변경: ', nl: 'Groottewijziging: ', pl: 'Zmiana rozmiaru: ', tr: 'Boyut değişimi: ', vi: 'Thay đổi kích thước: ', th: 'การเปลี่ยนขนาด: ', sv: 'Storleksändring: ' }],
];

function excluded(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]'));
}

function translateValue(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const exact = P[value.trim()]?.[locale];
  if (exact) return value.replace(value.trim(), exact);
  for (const [prefix, map] of PREFIXES) {
    if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  }
  return value;
}

function localize(root: HTMLElement, locale: Locale, toolId: string, normalizeStructure = true) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue?.trim() || excluded(node)) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translateValue(locale, current);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateValue(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });

  if (!normalizeStructure) return;

  const localizedTitle = getLocalizedToolTitle(locale, toolId, root.querySelector('h1')?.textContent?.trim() ?? toolId);
  root.querySelectorAll<HTMLElement>('h1').forEach((heading, index) => {
    if (index === 0) {
      if (heading.textContent !== localizedTitle) heading.textContent = localizedTitle;
      return;
    }
    const replacement = document.createElement('h2');
    for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
    replacement.textContent = heading.textContent?.trim() || localizedTitle;
    heading.replaceWith(replacement);
  });

  root.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main === root) return;
    const section = document.createElement('section');
    for (const attribute of main.attributes) section.setAttribute(attribute.name, attribute.value);
    while (main.firstChild) section.appendChild(main.firstChild);
    main.replaceWith(section);
  });
}

export function AutoLocalizedToolSurface({ locale, toolId, children }: Props) {
  useEffect(() => {
    if (locale === 'en') return;

    const root = document.querySelector<HTMLElement>('.tool-page-modern');
    if (!root) return;
    root.lang = LOCALE_METADATA[locale].languageTag;
    root.dir = LOCALE_METADATA[locale].direction;
    localize(root, locale, toolId);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;
          const element = addedNode as HTMLElement;
          if (element.matches('[data-no-auto-i18n]')) continue;
          localize(element, locale, toolId, false);
        }
      }
    });
    observer.observe(root, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [locale, toolId]);

  return <>{children}</>;
}
