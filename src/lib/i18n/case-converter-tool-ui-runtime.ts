import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI: Record<string, LocaleMap> = {
  'Case Converter': { ar:'محول حالة الأحرف', es:'Convertidor de mayúsculas y minúsculas', fr:'Convertisseur de casse', de:'Groß-/Kleinschreibung konvertieren', hi:'केस कन्वर्टर', id:'Pengonversi Huruf', it:'Convertitore maiuscole/minuscole', ja:'大文字・小文字コンバーター', ko:'대소문자 변환기', ms:'Penukar Huruf Besar/Kecil', nl:'Hoofdletterconverter', pl:'Konwerter wielkości liter', pt:'Conversor de maiúsculas/minúsculas', ru:'Конвертер регистра', sv:'Skiftlägeskonverterare', th:'ตัวแปลงตัวพิมพ์', tr:'Büyük/Küçük Harf Dönüştürücü', uk:'Конвертер регістру', vi:'Trình chuyển đổi kiểu chữ' },
  'Convert text between common letter and identifier cases locally in your browser.': { ar:'حوّل النص بين حالات الأحرف الشائعة وأنماط المعرّفات محليًا داخل متصفحك.', es:'Convierte texto entre mayúsculas, minúsculas y formatos de identificadores comunes localmente en tu navegador.', fr:'Convertissez le texte entre les casses courantes et les formats d’identifiants localement dans votre navigateur.', de:'Konvertieren Sie Text lokal im Browser zwischen gängigen Schreibweisen und Bezeichnerformaten.', hi:'अपने ब्राउज़र में टेक्स्ट को सामान्य अक्षर और आइडेंटिफ़ायर केस के बीच स्थानीय रूप से बदलें।', id:'Konversi teks antara huruf umum dan format pengenal secara lokal di browser.', it:'Converti il testo tra maiuscole, minuscole e formati identificatore comuni localmente nel browser.', ja:'ブラウザー内でテキストを一般的な大文字・小文字や識別子形式にローカル変換します。', ko:'브라우저에서 텍스트를 일반적인 대소문자 및 식별자 형식으로 로컬 변환합니다.', ms:'Tukar teks antara huruf biasa dan format pengecam secara tempatan dalam pelayar.', nl:'Converteer tekst lokaal in je browser tussen gangbare hoofdletterstijlen en identifierformaten.', pl:'Konwertuj tekst lokalnie w przeglądarce między popularnymi wielkościami liter i formatami identyfikatorów.', pt:'Converta texto localmente no navegador entre formatos comuns de maiúsculas, minúsculas e identificadores.', ru:'Локально преобразуйте текст в браузере между распространёнными регистрами и форматами идентификаторов.', sv:'Konvertera text lokalt i webbläsaren mellan vanliga skiftlägen och identifierarformat.', th:'แปลงข้อความระหว่างรูปแบบตัวพิมพ์และตัวระบุทั่วไปในเครื่องบนเบราว์เซอร์', tr:'Metni tarayıcınızda yaygın harf ve tanımlayıcı biçimleri arasında yerel olarak dönüştürün.', uk:'Локально перетворюйте текст у браузері між поширеними регістрами та форматами ідентифікаторів.', vi:'Chuyển đổi văn bản cục bộ trong trình duyệt giữa các kiểu chữ và định dạng mã định danh phổ biến.' },
  'Text input': { ar:'إدخال النص', es:'Entrada de texto', fr:'Saisie de texte', de:'Texteingabe', hi:'टेक्स्ट इनपुट', id:'Input teks', it:'Input testo', ja:'テキスト入力', ko:'텍스트 입력', ms:'Input teks', nl:'Tekstinvoer', pl:'Wprowadzanie tekstu', pt:'Entrada de texto', ru:'Ввод текста', sv:'Textinmatning', th:'ป้อนข้อความ', tr:'Metin girişi', uk:'Введення тексту', vi:'Nhập văn bản' },
  'Type or paste text here…': { ar:'اكتب النص أو الصقه هنا…', es:'Escribe o pega el texto aquí…', fr:'Saisissez ou collez le texte ici…', de:'Text hier eingeben oder einfügen…', hi:'टेक्स्ट यहाँ टाइप या पेस्ट करें…', id:'Ketik atau tempel teks di sini…', it:'Digita o incolla il testo qui…', ja:'ここにテキストを入力または貼り付け…', ko:'여기에 텍스트를 입력하거나 붙여넣으세요…', ms:'Taip atau tampal teks di sini…', nl:'Typ of plak hier tekst…', pl:'Wpisz lub wklej tekst tutaj…', pt:'Digite ou cole o texto aqui…', ru:'Введите или вставьте текст…', sv:'Skriv eller klistra in text här…', th:'พิมพ์หรือวางข้อความที่นี่…', tr:'Metni buraya yazın veya yapıştırın…', uk:'Введіть або вставте текст тут…', vi:'Nhập hoặc dán văn bản tại đây…' },
  'Case modes': { ar:'أنماط حالة الأحرف', es:'Modos de mayúsculas', fr:'Modes de casse', de:'Schreibweisen', hi:'केस मोड', id:'Mode huruf', it:'Modalità maiuscole/minuscole', ja:'ケースモード', ko:'대소문자 모드', ms:'Mod huruf', nl:'Hoofdlettermodi', pl:'Tryby wielkości liter', pt:'Modos de maiúsculas/minúsculas', ru:'Режимы регистра', sv:'Skiftlägen', th:'โหมดตัวพิมพ์', tr:'Harf biçimi modları', uk:'Режими регістру', vi:'Chế độ kiểu chữ' },
  UPPERCASE: { ar:'أحرف كبيرة', es:'MAYÚSCULAS', fr:'MAJUSCULES', de:'GROSSBUCHSTABEN', hi:'बड़े अक्षर', id:'HURUF BESAR', it:'MAIUSCOLO', ja:'大文字', ko:'대문자', ms:'HURUF BESAR', nl:'HOOFDLETTERS', pl:'WIELKIE LITERY', pt:'MAIÚSCULAS', ru:'ВЕРХНИЙ РЕГИСТР', sv:'VERSALER', th:'ตัวพิมพ์ใหญ่', tr:'BÜYÜK HARF', uk:'ВЕЛИКІ ЛІТЕРИ', vi:'CHỮ HOA' },
  lowercase: { ar:'أحرف صغيرة', es:'minúsculas', fr:'minuscules', de:'kleinbuchstaben', hi:'छोटे अक्षर', id:'huruf kecil', it:'minuscolo', ja:'小文字', ko:'소문자', ms:'huruf kecil', nl:'kleine letters', pl:'małe litery', pt:'minúsculas', ru:'нижний регистр', sv:'små bokstäver', th:'ตัวพิมพ์เล็ก', tr:'küçük harf', uk:'малі літери', vi:'chữ thường' },
  'Title Case': { ar:'حالة العنوان', es:'Tipo Título', fr:'Casse Titre', de:'Titel-Schreibweise', hi:'शीर्षक केस', id:'Huruf Judul', it:'Iniziali Maiuscole', ja:'タイトルケース', ko:'제목 형식', ms:'Huruf Tajuk', nl:'Titelstijl', pl:'Wielkość tytułowa', pt:'Capitalização de Título', ru:'Регистр заголовка', sv:'Titelstil', th:'ตัวพิมพ์หัวเรื่อง', tr:'Başlık Biçimi', uk:'Регістр заголовка', vi:'Kiểu tiêu đề' },
  'Sentence case': { ar:'حالة الجملة', es:'tipo oración', fr:'casse phrase', de:'Satzschreibung', hi:'वाक्य केस', id:'Format kalimat', it:'Maiuscola iniziale', ja:'文ケース', ko:'문장 형식', ms:'Format ayat', nl:'Zinsstijl', pl:'Wielkość zdaniowa', pt:'Formato de frase', ru:'Регистре предложения', sv:'Meningsstil', th:'รูปแบบประโยค', tr:'Cümle biçimi', uk:'Регістр речення', vi:'Kiểu câu' },
  camelCase: { ar:'camelCase', es:'camelCase', fr:'camelCase', de:'camelCase', hi:'camelCase', id:'camelCase', it:'camelCase', ja:'camelCase', ko:'camelCase', ms:'camelCase', nl:'camelCase', pl:'camelCase', pt:'camelCase', ru:'camelCase', sv:'camelCase', th:'camelCase', tr:'camelCase', uk:'camelCase', vi:'camelCase' },
  PascalCase: { ar:'PascalCase', es:'PascalCase', fr:'PascalCase', de:'PascalCase', hi:'PascalCase', id:'PascalCase', it:'PascalCase', ja:'PascalCase', ko:'PascalCase', ms:'PascalCase', nl:'PascalCase', pl:'PascalCase', pt:'PascalCase', ru:'PascalCase', sv:'PascalCase', th:'PascalCase', tr:'PascalCase', uk:'PascalCase', vi:'PascalCase' },
  snake_case: { ar:'snake_case', es:'snake_case', fr:'snake_case', de:'snake_case', hi:'snake_case', id:'snake_case', it:'snake_case', ja:'snake_case', ko:'snake_case', ms:'snake_case', nl:'snake_case', pl:'snake_case', pt:'snake_case', ru:'snake_case', sv:'snake_case', th:'snake_case', tr:'snake_case', uk:'snake_case', vi:'snake_case' },
  'kebab-case': { ar:'kebab-case', es:'kebab-case', fr:'kebab-case', de:'kebab-case', hi:'kebab-case', id:'kebab-case', it:'kebab-case', ja:'kebab-case', ko:'kebab-case', ms:'kebab-case', nl:'kebab-case', pl:'kebab-case', pt:'kebab-case', ru:'kebab-case', sv:'kebab-case', th:'kebab-case', tr:'kebab-case', uk:'kebab-case', vi:'kebab-case' },
  CONSTANT_CASE: { ar:'CONSTANT_CASE', es:'CONSTANT_CASE', fr:'CONSTANT_CASE', de:'CONSTANT_CASE', hi:'CONSTANT_CASE', id:'CONSTANT_CASE', it:'CONSTANT_CASE', ja:'CONSTANT_CASE', ko:'CONSTANT_CASE', ms:'CONSTANT_CASE', nl:'CONSTANT_CASE', pl:'CONSTANT_CASE', pt:'CONSTANT_CASE', ru:'CONSTANT_CASE', sv:'CONSTANT_CASE', th:'CONSTANT_CASE', tr:'CONSTANT_CASE', uk:'CONSTANT_CASE', vi:'CONSTANT_CASE' },
  'Converted output': { ar:'الناتج المحوّل', es:'Resultado convertido', fr:'Sortie convertie', de:'Konvertierte Ausgabe', hi:'परिवर्तित आउटपुट', id:'Hasil konversi', it:'Output convertito', ja:'変換後の出力', ko:'변환 결과', ms:'Output ditukar', nl:'Geconverteerde uitvoer', pl:'Przekonwertowany wynik', pt:'Resultado convertido', ru:'Преобразованный результат', sv:'Konverterat resultat', th:'ผลลัพธ์ที่แปลงแล้ว', tr:'Dönüştürülmüş çıktı', uk:'Перетворений результат', vi:'Kết quả đã chuyển đổi' },
  Copy: { ar:'نسخ', es:'Copiar', fr:'Copier', de:'Kopieren', hi:'कॉपी', id:'Salin', it:'Copia', ja:'コピー', ko:'복사', ms:'Salin', nl:'Kopiëren', pl:'Kopiuj', pt:'Copiar', ru:'Копировать', sv:'Kopiera', th:'คัดลอก', tr:'Kopyala', uk:'Копіювати', vi:'Sao chép' },
  Clear: { ar:'مسح', es:'Borrar', fr:'Effacer', de:'Löschen', hi:'साफ़ करें', id:'Hapus', it:'Cancella', ja:'クリア', ko:'지우기', ms:'Kosongkan', nl:'Wissen', pl:'Wyczyść', pt:'Limpar', ru:'Очистить', sv:'Rensa', th:'ล้าง', tr:'Temizle', uk:'Очистити', vi:'Xóa' },
  'Text statistics': { ar:'إحصائيات النص', es:'Estadísticas de texto', fr:'Statistiques du texte', de:'Textstatistiken', hi:'टेक्स्ट आँकड़े', id:'Statistik teks', it:'Statistiche del testo', ja:'テキスト統計', ko:'텍스트 통계', ms:'Statistik teks', nl:'Tekststatistieken', pl:'Statystyki tekstu', pt:'Estatísticas do texto', ru:'Статистика текста', sv:'Textstatistik', th:'สถิติข้อความ', tr:'Metin istatistikleri', uk:'Статистика тексту', vi:'Thống kê văn bản' },
  Characters: { ar:'الأحرف', es:'Caracteres', fr:'Caractères', de:'Zeichen', hi:'अक्षर', id:'Karakter', it:'Caratteri', ja:'文字数', ko:'문자', ms:'Aksara', nl:'Tekens', pl:'Znaki', pt:'Caracteres', ru:'Символы', sv:'Tecken', th:'อักขระ', tr:'Karakter', uk:'Символи', vi:'Ký tự' },
  Words: { ar:'الكلمات', es:'Palabras', fr:'Mots', de:'Wörter', hi:'शब्द', id:'Kata', it:'Parole', ja:'単語', ko:'단어', ms:'Perkataan', nl:'Woorden', pl:'Słowa', pt:'Palavras', ru:'Слова', sv:'Ord', th:'คำ', tr:'Kelimeler', uk:'Слова', vi:'Từ' },
  Mode: { ar:'الوضع', es:'Modo', fr:'Mode', de:'Modus', hi:'मोड', id:'Mode', it:'Modalità', ja:'モード', ko:'모드', ms:'Mod', nl:'Modus', pl:'Tryb', pt:'Modo', ru:'Режим', sv:'Läge', th:'โหมด', tr:'Mod', uk:'Режим', vi:'Chế độ' },
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

export function installCaseConverterToolUiRuntimeLocalization(): () => void {
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
