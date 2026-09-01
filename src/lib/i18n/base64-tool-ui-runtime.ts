import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI: Record<string, LocaleMap> = {
  'Base64 Encoder / Decoder': { ar:'مشفّر وفاكّ Base64', es:'Codificador / Decodificador Base64', fr:'Encodeur / Décodeur Base64', de:'Base64-Kodierer / Dekodierer', hi:'Base64 एनकोडर / डिकोडर', id:'Encoder / Decoder Base64', it:'Codificatore / Decodificatore Base64', ja:'Base64 エンコーダー / デコーダー', ko:'Base64 인코더 / 디코더', ms:'Pengekod / Penyahkod Base64', nl:'Base64-encoder / decoder', pl:'Koder / Dekoder Base64', pt:'Codificador / Decodificador Base64', ru:'Кодировщик / декодировщик Base64', sv:'Base64-kodare / avkodare', th:'ตัวเข้ารหัส / ถอดรหัส Base64', tr:'Base64 Kodlayıcı / Kod Çözücü', uk:'Кодувальник / декодувальник Base64', vi:'Bộ mã hóa / giải mã Base64' },
  'Encode text and files or decode Base64 entirely in your browser.': { ar:'شفّر النصوص والملفات أو فك Base64 بالكامل داخل متصفحك.', es:'Codifica texto y archivos o decodifica Base64 completamente en tu navegador.', fr:'Encodez du texte et des fichiers ou décodez Base64 entièrement dans votre navigateur.', de:'Kodieren Sie Text und Dateien oder dekodieren Sie Base64 vollständig im Browser.', hi:'अपने ब्राउज़र में टेक्स्ट और फ़ाइलों को एन्कोड करें या Base64 को पूरी तरह डिकोड करें।', id:'Encode teks dan berkas atau dekode Base64 sepenuhnya di browser Anda.', it:'Codifica testo e file o decodifica Base64 interamente nel browser.', ja:'ブラウザー内でテキストやファイルをエンコードし、Base64を完全にデコードします。', ko:'브라우저에서 텍스트와 파일을 인코딩하거나 Base64를 완전히 디코딩합니다.', ms:'Kod teks dan fail atau nyahkod Base64 sepenuhnya dalam pelayar anda.', nl:'Codeer tekst en bestanden of decodeer Base64 volledig in je browser.', pl:'Koduj tekst i pliki lub dekoduj Base64 całkowicie w przeglądarce.', pt:'Codifique texto e arquivos ou decodifique Base64 inteiramente no navegador.', ru:'Кодируйте текст и файлы или полностью декодируйте Base64 в браузере.', sv:'Koda text och filer eller avkoda Base64 helt i webbläsaren.', th:'เข้ารหัสข้อความและไฟล์หรือถอดรหัส Base64 ทั้งหมดในเบราว์เซอร์', tr:"Tarayıcınızda metin ve dosyaları kodlayın veya Base64'ü tamamen çözün.", uk:'Кодуйте текст і файли або повністю декодуйте Base64 у браузері.', vi:'Mã hóa văn bản và tệp hoặc giải mã Base64 hoàn toàn trong trình duyệt.' },
  Encode: { ar:'ترميز', es:'Codificar', fr:'Encoder', de:'Kodieren', hi:'एन्कोड', id:'Encode', it:'Codifica', ja:'エンコード', ko:'인코드', ms:'Encode', nl:'Coderen', pl:'Koduj', pt:'Codificar', ru:'Кодировать', sv:'Koda', th:'เข้ารหัส', tr:'Kodla', uk:'Кодувати', vi:'Mã hóa' },
  Decode: { ar:'فك الترميز', es:'Decodificar', fr:'Décoder', de:'Dekodieren', hi:'डिकोड', id:'Dekode', it:'Decodifica', ja:'デコード', ko:'디코드', ms:'Nyahkod', nl:'Decoderen', pl:'Dekoduj', pt:'Decodificar', ru:'Декодировать', sv:'Avkoda', th:'ถอดรหัส', tr:'Kodu çöz', uk:'Декодувати', vi:'Giải mã' },
  Run: { ar:'تشغيل', es:'Ejecutar', fr:'Exécuter', de:'Ausführen', hi:'चलाएँ', id:'Jalankan', it:'Esegui', ja:'実行', ko:'실행', ms:'Jalankan', nl:'Uitvoeren', pl:'Uruchom', pt:'Executar', ru:'Запустить', sv:'Kör', th:'เรียกใช้', tr:'Çalıştır', uk:'Запустити', vi:'Chạy' },
  'Preview Data URI': { ar:'معاينة Data URI', es:'Vista previa de Data URI', fr:'Aperçu de Data URI', de:'Data-URI-Vorschau', hi:'Data URI पूर्वावलोकन', id:'Pratinjau Data URI', it:'Anteprima Data URI', ja:'Data URIをプレビュー', ko:'Data URI 미리보기', ms:'Pratonton Data URI', nl:'Data URI-voorbeeld', pl:'Podgląd Data URI', pt:'Pré-visualizar Data URI', ru:'Предпросмотр Data URI', sv:'Förhandsgranska Data URI', th:'แสดงตัวอย่าง Data URI', tr:'Data URI önizleme', uk:'Попередній перегляд Data URI', vi:'Xem trước Data URI' },
  Download: { ar:'تنزيل', es:'Descargar', fr:'Télécharger', de:'Herunterladen', hi:'डाउनलोड', id:'Unduh', it:'Scarica', ja:'ダウンロード', ko:'다운로드', ms:'Muat turun', nl:'Downloaden', pl:'Pobierz', pt:'Baixar', ru:'Скачать', sv:'Ladda ner', th:'ดาวน์โหลด', tr:'İndir', uk:'Завантажити', vi:'Tải xuống' },
  File: { ar:'ملف', es:'Archivo', fr:'Fichier', de:'Datei', hi:'फ़ाइल', id:'Berkas', it:'File', ja:'ファイル', ko:'파일', ms:'Fail', nl:'Bestand', pl:'Plik', pt:'Arquivo', ru:'Файл', sv:'Fil', th:'ไฟล์', tr:'Dosya', uk:'Файл', vi:'Tệp' },
  Input: { ar:'الإدخال', es:'Entrada', fr:'Entrée', de:'Eingabe', hi:'इनपुट', id:'Input', it:'Input', ja:'入力', ko:'입력', ms:'Input', nl:'Invoer', pl:'Wejście', pt:'Entrada', ru:'Ввод', sv:'Indata', th:'อินพุต', tr:'Girdi', uk:'Введення', vi:'Đầu vào' },
  Output: { ar:'الناتج', es:'Salida', fr:'Sortie', de:'Ausgabe', hi:'आउटपुट', id:'Output', it:'Output', ja:'出力', ko:'출력', ms:'Output', nl:'Uitvoer', pl:'Wyjście', pt:'Saída', ru:'Вывод', sv:'Utdata', th:'เอาต์พุต', tr:'Çıktı', uk:'Вивід', vi:'Đầu ra' },
  'Invalid Base64 input': { ar:'إدخال Base64 غير صالح', es:'Entrada Base64 no válida', fr:'Entrée Base64 invalide', de:'Ungültige Base64-Eingabe', hi:'अमान्य Base64 इनपुट', id:'Input Base64 tidak valid', it:'Input Base64 non valido', ja:'無効なBase64入力', ko:'잘못된 Base64 입력', ms:'Input Base64 tidak sah', nl:'Ongeldige Base64-invoer', pl:'Nieprawidłowe dane wejściowe Base64', pt:'Entrada Base64 inválida', ru:'Недопустимый ввод Base64', sv:'Ogiltig Base64-indata', th:'ข้อมูล Base64 ไม่ถูกต้อง', tr:'Geçersiz Base64 girdisi', uk:'Недійсні дані Base64', vi:'Dữ liệu Base64 không hợp lệ' },
  'Unable to read file': { ar:'تعذر قراءة الملف', es:'No se pudo leer el archivo', fr:'Impossible de lire le fichier', de:'Datei konnte nicht gelesen werden', hi:'फ़ाइल पढ़ी नहीं जा सकी', id:'Tidak dapat membaca berkas', it:'Impossibile leggere il file', ja:'ファイルを読み取れません', ko:'파일을 읽을 수 없습니다', ms:'Tidak dapat membaca fail', nl:'Kan bestand niet lezen', pl:'Nie można odczytać pliku', pt:'Não foi possível ler o arquivo', ru:'Не удалось прочитать файл', sv:'Kunde inte läsa filen', th:'ไม่สามารถอ่านไฟล์ได้', tr:'Dosya okunamadı', uk:'Не вдалося прочитати файл', vi:'Không thể đọc tệp' },
  'Invalid Base64 data URI': { ar:'Data URI لـ Base64 غير صالح', es:'Data URI Base64 no válida', fr:'Data URI Base64 invalide', de:'Ungültige Base64-Data-URI', hi:'अमान्य Base64 Data URI', id:'Data URI Base64 tidak valid', it:'Data URI Base64 non valido', ja:'無効なBase64 Data URI', ko:'잘못된 Base64 Data URI', ms:'Data URI Base64 tidak sah', nl:'Ongeldige Base64 Data URI', pl:'Nieprawidłowy Data URI Base64', pt:'Data URI Base64 inválida', ru:'Недопустимый Base64 Data URI', sv:'Ogiltig Base64 Data URI', th:'Data URI Base64 ไม่ถูกต้อง', tr:'Geçersiz Base64 Data URI', uk:'Недійсний Base64 Data URI', vi:'Data URI Base64 không hợp lệ' },
  'Decoded preview': { ar:'معاينة مفكوكة الترميز', es:'Vista previa decodificada', fr:'Aperçu décodé', de:'Dekodierte Vorschau', hi:'डिकोड किया गया पूर्वावलोकन', id:'Pratinjau terdekode', it:'Anteprima decodificata', ja:'デコード済みプレビュー', ko:'디코딩된 미리보기', ms:'Pratonton dinyahkod', nl:'Gedecodeerd voorbeeld', pl:'Podgląd zdekodowany', pt:'Pré-visualização decodificada', ru:'Декодированный предпросмотр', sv:'Avkodad förhandsvisning', th:'ตัวอย่างที่ถอดรหัสแล้ว', tr:'Kodu çözülmüş önizleme', uk:'Попередній перегляд декодованих даних', vi:'Xem trước đã giải mã' },
};

function translateText(value: string, locale: Locale): string {
  if (locale === 'en') return value;
  let next = value;
  for (const [source, translations] of Object.entries(UI)) {
    const target = translations[locale];
    if (!target) continue;
    next = next.replaceAll(source, target);
  }
  return next;
}

function apply(root: ParentNode, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translateText(current, locale);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translateText(current, locale);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
}

export function installBase64ToolUiRuntimeLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const applyCurrent = () => {
    const locale = (document.documentElement.lang.split('-')[0] || 'en') as Locale;
    if (locale !== 'en') apply(document.body, locale);
  };
  applyCurrent();
  const observer = new MutationObserver(applyCurrent);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
