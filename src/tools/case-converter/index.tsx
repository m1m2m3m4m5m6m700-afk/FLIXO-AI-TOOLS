import { useMemo, useState } from 'react';
import { convertCase, type CaseMode } from './engine';
import { normalizeLocale, type Locale } from '../../lib/i18n/config';

type CaseCopy = { characters: string; words: string; mode: string; copy: string; clear: string; input: string; output: string; placeholder: string; description: string; title: string };

const MODE_LABELS: Record<Locale, Record<CaseMode, string>> = {
  en: { upper:'UPPERCASE',lower:'lowercase',title:'Title Case',sentence:'Sentence case',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  ar: { upper:'أحرف كبيرة',lower:'أحرف صغيرة',title:'حالة العنوان',sentence:'حالة الجملة',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  es: { upper:'MAYÚSCULAS',lower:'minúsculas',title:'Tipo título',sentence:'Tipo oración',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  fr: { upper:'MAJUSCULES',lower:'minuscules',title:'Casse titre',sentence:'Casse phrase',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  de: { upper:'GROSSBUCHSTABEN',lower:'Kleinbuchstaben',title:'Titelschreibweise',sentence:'Satzschreibweise',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  ru: { upper:'ПРОПИСНЫЕ',lower:'строчные',title:'Регистр заголовка',sentence:'Регистр предложения',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  zh: { upper:'大写',lower:'小写',title:'标题格式',sentence:'句子格式',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  hi: { upper:'बड़े अक्षर',lower:'छोटे अक्षर',title:'शीर्षक केस',sentence:'वाक्य केस',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  id: { upper:'HURUF BESAR',lower:'huruf kecil',title:'Huruf Judul',sentence:'Huruf Kalimat',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  ur: { upper:'بڑے حروف',lower:'چھوٹے حروف',title:'عنوانی انداز',sentence:'جملے کا انداز',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  ja: { upper:'大文字',lower:'小文字',title:'タイトル形式',sentence:'文形式',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  pt: { upper:'MAIÚSCULAS',lower:'minúsculas',title:'Caixa de título',sentence:'Caixa de frase',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  it: { upper:'MAIUSCOLO',lower:'minuscolo',title:'Formato titolo',sentence:'Formato frase',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  ko: { upper:'대문자',lower:'소문자',title:'제목 형식',sentence:'문장 형식',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  nl: { upper:'HOOFDLETTERS',lower:'kleine letters',title:'Titelvorm',sentence:'Zinsvorm',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  pl: { upper:'WIELKIE LITERY',lower:'małe litery',title:'Format tytułu',sentence:'Format zdania',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  tr: { upper:'BÜYÜK HARF',lower:'küçük harf',title:'Başlık biçimi',sentence:'Cümle biçimi',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  vi: { upper:'CHỮ HOA',lower:'chữ thường',title:'Kiểu tiêu đề',sentence:'Kiểu câu',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  th: { upper:'ตัวพิมพ์ใหญ่',lower:'ตัวพิมพ์เล็ก',title:'รูปแบบชื่อเรื่อง',sentence:'รูปแบบประโยค',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
  sv: { upper:'VERSALER',lower:'gemener',title:'Titelstil',sentence:'Meningsstil',camel:'camelCase',pascal:'PascalCase',snake:'snake_case',kebab:'kebab-case',constant:'CONSTANT_CASE' },
};

const COPY: Record<Locale, CaseCopy> = {
  en:{title:'Case Converter',characters:'Characters',words:'Words',mode:'Mode',copy:'Copy',clear:'Clear',input:'Text input',output:'Converted output',placeholder:'Type or paste text here…',description:'Convert text between common letter and identifier cases locally in your browser.'},
  ar:{title:'محول حالات الأحرف',characters:'الأحرف',words:'الكلمات',mode:'الوضع',copy:'نسخ',clear:'مسح',input:'إدخال النص',output:'الناتج المحوّل',placeholder:'اكتب النص أو الصقه هنا…',description:'حوّل النص بين حالات الأحرف وأنماط المعرّفات الشائعة محليًا في متصفحك.'},
  es:{title:'Convertidor de mayúsculas y minúsculas',characters:'Caracteres',words:'Palabras',mode:'Modo',copy:'Copiar',clear:'Borrar',input:'Entrada de texto',output:'Salida convertida',placeholder:'Escribe o pega el texto aquí…',description:'Convierte texto entre formatos comunes localmente en tu navegador.'},
  fr:{title:'Convertisseur de casse',characters:'Caractères',words:'Mots',mode:'Mode',copy:'Copier',clear:'Effacer',input:'Saisie de texte',output:'Sortie convertie',placeholder:'Saisissez ou collez le texte ici…',description:'Convertissez le texte entre les casses courantes localement dans votre navigateur.'},
  de:{title:'Schreibweisen-Konverter',characters:'Zeichen',words:'Wörter',mode:'Modus',copy:'Kopieren',clear:'Löschen',input:'Texteingabe',output:'Konvertierte Ausgabe',placeholder:'Text hier eingeben oder einfügen…',description:'Konvertieren Sie Text lokal zwischen gängigen Schreibweisen.'},
  ru:{title:'Конвертер регистра',characters:'Символы',words:'Слова',mode:'Режим',copy:'Копировать',clear:'Очистить',input:'Ввод текста',output:'Преобразованный результат',placeholder:'Введите или вставьте текст…',description:'Локально преобразуйте текст между распространёнными регистрами.'},
  zh:{title:'大小写转换器',characters:'字符',words:'单词',mode:'模式',copy:'复制',clear:'清除',input:'文本输入',output:'转换后的输出',placeholder:'在此输入或粘贴文本…',description:'在浏览器本地转换常见的字母和标识符格式。'},
  hi:{title:'केस कन्वर्टर',characters:'अक्षर',words:'शब्द',mode:'मोड',copy:'कॉपी करें',clear:'साफ़ करें',input:'टेक्स्ट इनपुट',output:'रूपांतरित आउटपुट',placeholder:'यहाँ टेक्स्ट लिखें या चिपकाएँ…',description:'अपने ब्राउज़र में सामान्य अक्षर और पहचानकर्ता केस के बीच टेक्स्ट बदलें।'},
  id:{title:'Konverter Huruf',characters:'Karakter',words:'Kata',mode:'Mode',copy:'Salin',clear:'Hapus',input:'Input teks',output:'Hasil konversi',placeholder:'Ketik atau tempel teks di sini…',description:'Konversi teks secara lokal antara format huruf dan pengenal yang umum.'},
  ur:{title:'حروف کی تبدیلی',characters:'حروف',words:'الفاظ',mode:'موڈ',copy:'کاپی',clear:'صاف کریں',input:'متن کا اندراج',output:'تبدیل شدہ نتیجہ',placeholder:'یہاں متن لکھیں یا چسپاں کریں…',description:'اپنے براؤزر میں متن کو عام حروف اور شناختی انداز میں مقامی طور پر تبدیل کریں۔'},
  ja:{title:'大文字・小文字変換',characters:'文字',words:'単語',mode:'モード',copy:'コピー',clear:'クリア',input:'テキスト入力',output:'変換後の出力',placeholder:'ここにテキストを入力または貼り付け…',description:'ブラウザ上で一般的な文字形式と識別子形式をローカルに変換します。'},
  pt:{title:'Conversor de maiúsculas e minúsculas',characters:'Caracteres',words:'Palavras',mode:'Modo',copy:'Copiar',clear:'Limpar',input:'Entrada de texto',output:'Saída convertida',placeholder:'Digite ou cole o texto aqui…',description:'Converta texto entre formatos comuns localmente no navegador.'},
  it:{title:'Convertitore di maiuscole e minuscole',characters:'Caratteri',words:'Parole',mode:'Modalità',copy:'Copia',clear:'Cancella',input:'Inserimento testo',output:'Output convertito',placeholder:'Digita o incolla il testo qui…',description:'Converti il testo tra i formati comuni direttamente nel browser.'},
  ko:{title:'대소문자 변환기',characters:'문자',words:'단어',mode:'모드',copy:'복사',clear:'지우기',input:'텍스트 입력',output:'변환된 출력',placeholder:'여기에 텍스트를 입력하거나 붙여넣으세요…',description:'브라우저에서 일반적인 문자 및 식별자 형식으로 텍스트를 변환합니다.'},
  nl:{title:'Schrijfwijze-converter',characters:'Tekens',words:'Woorden',mode:'Modus',copy:'Kopiëren',clear:'Wissen',input:'Tekstinvoer',output:'Geconverteerde uitvoer',placeholder:'Typ of plak hier tekst…',description:'Converteer tekst lokaal tussen veelgebruikte schrijfwijzen.'},
  pl:{title:'Konwerter wielkości liter',characters:'Znaki',words:'Słowa',mode:'Tryb',copy:'Kopiuj',clear:'Wyczyść',input:'Wprowadzanie tekstu',output:'Przekonwertowane wyjście',placeholder:'Wpisz lub wklej tekst tutaj…',description:'Konwertuj tekst lokalnie między popularnymi formatami.'},
  tr:{title:'Büyük Küçük Harf Dönüştürücü',characters:'Karakter',words:'Kelime',mode:'Mod',copy:'Kopyala',clear:'Temizle',input:'Metin girişi',output:'Dönüştürülen çıktı',placeholder:'Metni buraya yazın veya yapıştırın…',description:'Metni tarayıcınızda yaygın biçimler arasında yerel olarak dönüştürün.'},
  vi:{title:'Bộ chuyển đổi kiểu chữ',characters:'Ký tự',words:'Từ',mode:'Chế độ',copy:'Sao chép',clear:'Xóa',input:'Nhập văn bản',output:'Đầu ra đã chuyển đổi',placeholder:'Nhập hoặc dán văn bản tại đây…',description:'Chuyển đổi văn bản giữa các kiểu chữ và định danh phổ biến ngay trong trình duyệt.'},
  th:{title:'ตัวแปลงรูปแบบตัวอักษร',characters:'อักขระ',words:'คำ',mode:'โหมด',copy:'คัดลอก',clear:'ล้าง',input:'ป้อนข้อความ',output:'ผลลัพธ์ที่แปลงแล้ว',placeholder:'พิมพ์หรือวางข้อความที่นี่…',description:'แปลงข้อความระหว่างรูปแบบตัวอักษรและตัวระบุทั่วไปในเบราว์เซอร์'},
  sv:{title:'Konverterare för skiftläge',characters:'Tecken',words:'Ord',mode:'Läge',copy:'Kopiera',clear:'Rensa',input:'Textinmatning',output:'Konverterad utdata',placeholder:'Skriv eller klistra in text här…',description:'Konvertera text lokalt mellan vanliga format i webbläsaren.'},
};

export function CaseConverterTool({ locale: localeProp }: { locale?: Locale }) {
  const locale = normalizeLocale(localeProp ?? (typeof document === 'undefined' ? 'en' : document.documentElement.lang));
  const copy = COPY[locale];
  const modes = useMemo(() => Object.entries(MODE_LABELS[locale]).map(([id, label]) => ({ id: id as CaseMode, label })), [locale]);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CaseMode>('upper');
  const output = useMemo(() => convertCase(text, mode), [text, mode]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="case-converter-title">
      <header><h1 id="case-converter-title" className="text-3xl font-bold">{copy.title}</h1><p className="mt-2 text-sm opacity-75">{copy.description}</p></header>
      <textarea aria-label={copy.input} value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} className="min-h-56 w-full resize-y rounded-2xl border p-4" />
      <div className="grid gap-2 sm:grid-cols-3" aria-label={copy.mode}>
        {modes.map(({ id, label }) => <button key={id} type="button" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${mode === id ? 'border-current' : 'opacity-70'}`} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}
      </div>
      <textarea aria-label={copy.output} value={output} readOnly className="min-h-56 w-full resize-y rounded-2xl border p-4" />
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded-xl border px-4 py-2" onClick={() => navigator.clipboard.writeText(output)} disabled={!output}>{copy.copy}</button><button type="button" className="rounded-xl border px-4 py-2" onClick={() => setText('')} disabled={!text}>{copy.clear}</button></div>
      <div className="grid gap-3 sm:grid-cols-3" aria-label={copy.mode}>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{copy.characters}</div><div className="text-2xl font-bold">{[...text].length}</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{copy.words}</div><div className="text-2xl font-bold">{text.trim() ? text.trim().split(/\s+/u).length : 0}</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{copy.mode}</div><div className="text-2xl font-bold">{modes.find(({ id }) => id === mode)?.label}</div></div>
      </div>
    </section>
  );
}
