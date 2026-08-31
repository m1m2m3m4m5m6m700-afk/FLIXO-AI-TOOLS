import React, { useMemo, useState } from 'react';
import { buildJsonTree, formatJson, minifyJson, toCsv, toYaml, validateJson } from './engine';
import { normalizeLocale, type Locale } from '../../lib/i18n/config';

const DEFAULT_JSON = '{\n  "name": "FLIXO",\n  "tools": 20,\n  "ready": true\n}';

type TreeNodeProps = { value: unknown; depth?: number };
const TreeNode = ({ value, depth = 0 }: TreeNodeProps) => {
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
    return <div style={{ marginLeft: depth * 12 }}>{entries.map(([key, child]) => <div key={`${depth}-${key}`}><span className="font-medium">{key}:</span>{' '}{child && typeof child === 'object' ? <TreeNode value={child} depth={depth + 1} /> : <span>{JSON.stringify(child)}</span>}</div>)}</div>;
  }
  return <span>{JSON.stringify(value)}</span>;
};

type JsonCopy = {
  title: string;
  description: string;
  prettify: string;
  minify: string;
  yaml: string;
  csv: string;
  spaces: string;
  treeView: string;
  editorView: string;
  copy: string;
  download: string;
  input: string;
  output: string;
  valid: string;
  invalid: string;
  line: string;
  column: string;
  error: string;
};

const COPY: Record<Locale, JsonCopy> = {
  en: { title: 'JSON Formatter & Validator', description: 'Format, validate, inspect, convert, copy, and download JSON locally.', prettify: 'Prettify', minify: 'Minify', yaml: 'YAML format', csv: 'CSV', spaces: 'Spaces', treeView: 'Tree View', editorView: 'Editor View', copy: 'Copy', download: 'Download', input: 'JSON Input', output: 'Output', valid: 'Valid JSON', invalid: 'Invalid JSON', line: 'line', column: 'column', error: 'Error' },
  ar: { title: 'منسق ومدقق JSON', description: 'نسّق JSON وتحقق منه وافحصه وحوّله وانسخه ونزّله محليًا.', prettify: 'تنسيق جميل', minify: 'تصغير', yaml: 'صيغة YAML', csv: 'CSV', spaces: 'مسافات', treeView: 'عرض شجري', editorView: 'عرض المحرر', copy: 'نسخ', download: 'تنزيل', input: 'إدخال JSON', output: 'الناتج', valid: 'JSON صالح', invalid: 'JSON غير صالح', line: 'السطر', column: 'العمود', error: 'خطأ' },
  es: { title: 'Formateador y validador JSON', description: 'Formatea, valida, inspecciona, convierte, copia y descarga JSON localmente.', prettify: 'Embellecer', minify: 'Minificar', yaml: 'Formato YAML', csv: 'CSV', spaces: 'Espacios', treeView: 'Vista de árbol', editorView: 'Vista del editor', copy: 'Copiar', download: 'Descargar', input: 'Entrada JSON', output: 'Salida', valid: 'JSON válido', invalid: 'JSON no válido', line: 'línea', column: 'columna', error: 'Error' },
  fr: { title: 'Formateur et validateur JSON', description: 'Formatez, validez, inspectez, convertissez, copiez et téléchargez du JSON localement.', prettify: 'Embellir', minify: 'Minifier', yaml: 'Format YAML', csv: 'CSV', spaces: 'Espaces', treeView: 'Vue arborescente', editorView: 'Vue éditeur', copy: 'Copier', download: 'Télécharger', input: 'Entrée JSON', output: 'Sortie', valid: 'JSON valide', invalid: 'JSON invalide', line: 'ligne', column: 'colonne', error: 'Erreur' },
  de: { title: 'JSON-Formatierer und -Validator', description: 'JSON lokal formatieren, validieren, prüfen, konvertieren, kopieren und herunterladen.', prettify: 'Formatieren', minify: 'Minimieren', yaml: 'YAML-Format', csv: 'CSV', spaces: 'Leerzeichen', treeView: 'Baumansicht', editorView: 'Editoransicht', copy: 'Kopieren', download: 'Herunterladen', input: 'JSON-Eingabe', output: 'Ausgabe', valid: 'Gültiges JSON', invalid: 'Ungültiges JSON', line: 'Zeile', column: 'Spalte', error: 'Fehler' },
  ru: { title: 'Форматтер и валидатор JSON', description: 'Форматируйте, проверяйте, просматривайте, преобразуйте, копируйте и скачивайте JSON локально.', prettify: 'Форматировать', minify: 'Минифицировать', yaml: 'Формат YAML', csv: 'CSV', spaces: 'Пробелы', treeView: 'Древовидный вид', editorView: 'Вид редактора', copy: 'Копировать', download: 'Скачать', input: 'Ввод JSON', output: 'Результат', valid: 'Корректный JSON', invalid: 'Некорректный JSON', line: 'строка', column: 'столбец', error: 'Ошибка' },
  zh: { title: 'JSON 格式化与验证', description: '在本地格式化、验证、检查、转换、复制和下载 JSON。', prettify: '美化', minify: '压缩', yaml: 'YAML 格式', csv: 'CSV', spaces: '空格', treeView: '树状视图', editorView: '编辑器视图', copy: '复制', download: '下载', input: 'JSON 输入', output: '输出', valid: 'JSON 有效', invalid: 'JSON 无效', line: '行', column: '列', error: '错误' },
  hi: { title: 'JSON फॉर्मेटर और वैलिडेटर', description: 'ब्राउज़र में JSON को स्थानीय रूप से फ़ॉर्मैट, सत्यापित, निरीक्षण, रूपांतरित, कॉपी और डाउनलोड करें।', prettify: 'सुंदर फ़ॉर्मैट', minify: 'छोटा करें', yaml: 'YAML फ़ॉर्मैट', csv: 'CSV', spaces: 'स्पेस', treeView: 'ट्री दृश्य', editorView: 'एडिटर दृश्य', copy: 'कॉपी करें', download: 'डाउनलोड करें', input: 'JSON इनपुट', output: 'आउटपुट', valid: 'मान्य JSON', invalid: 'अमान्य JSON', line: 'पंक्ति', column: 'कॉलम', error: 'त्रुटि' },
  id: { title: 'Formatter & Validator JSON', description: 'Format, validasi, periksa, ubah, salin, dan unduh JSON secara lokal.', prettify: 'Percantik', minify: 'Minifikasi', yaml: 'Format YAML', csv: 'CSV', spaces: 'Spasi', treeView: 'Tampilan pohon', editorView: 'Tampilan editor', copy: 'Salin', download: 'Unduh', input: 'Input JSON', output: 'Output', valid: 'JSON valid', invalid: 'JSON tidak valid', line: 'baris', column: 'kolom', error: 'Kesalahan' },
  ur: { title: 'JSON فارمیٹر اور ویلیڈیٹر', description: 'JSON کو مقامی طور پر فارمیٹ، جانچ، معائنہ، تبدیل، کاپی اور ڈاؤن لوڈ کریں۔', prettify: 'خوبصورت فارمیٹ', minify: 'مختصر کریں', yaml: 'YAML فارمیٹ', csv: 'CSV', spaces: 'خالی جگہیں', treeView: 'درختی منظر', editorView: 'ایڈیٹر منظر', copy: 'کاپی کریں', download: 'ڈاؤن لوڈ کریں', input: 'JSON اندراج', output: 'نتیجہ', valid: 'درست JSON', invalid: 'غلط JSON', line: 'سطر', column: 'کالم', error: 'خرابی' },
  ja: { title: 'JSON整形・検証', description: 'JSON をローカルで整形、検証、確認、変換、コピー、ダウンロードします。', prettify: '整形', minify: '最小化', yaml: 'YAML 形式', csv: 'CSV', spaces: 'スペース', treeView: 'ツリービュー', editorView: 'エディタービュー', copy: 'コピー', download: 'ダウンロード', input: 'JSON入力', output: '出力', valid: '有効なJSON', invalid: '無効なJSON', line: '行', column: '列', error: 'エラー' },
  pt: { title: 'Formatador e Validador JSON', description: 'Formate, valide, inspecione, converta, copie e baixe JSON localmente.', prettify: 'Formatar', minify: 'Minificar', yaml: 'Formato YAML', csv: 'CSV', spaces: 'Espaços', treeView: 'Visualização em árvore', editorView: 'Visualização do editor', copy: 'Copiar', download: 'Baixar', input: 'Entrada JSON', output: 'Saída', valid: 'JSON válido', invalid: 'JSON inválido', line: 'linha', column: 'coluna', error: 'Erro' },
  it: { title: 'Formattatore e validatore JSON', description: 'Formatta, valida, ispeziona, converte, copia e scarica JSON localmente.', prettify: 'Formatta', minify: 'Minifica', yaml: 'Formato YAML', csv: 'CSV', spaces: 'Spazi', treeView: 'Vista ad albero', editorView: 'Vista editor', copy: 'Copia', download: 'Scarica', input: 'Input JSON', output: 'Output', valid: 'JSON valido', invalid: 'JSON non valido', line: 'riga', column: 'colonna', error: 'Errore' },
  ko: { title: 'JSON 포맷터 및 검증기', description: 'JSON을 브라우저에서 로컬로 서식 지정, 검증, 검사, 변환, 복사 및 다운로드합니다.', prettify: '예쁘게 정렬', minify: '압축', yaml: 'YAML 형식', csv: 'CSV', spaces: '공백', treeView: '트리 보기', editorView: '편집기 보기', copy: '복사', download: '다운로드', input: 'JSON 입력', output: '출력', valid: '유효한 JSON', invalid: '유효하지 않은 JSON', line: '줄', column: '열', error: '오류' },
  nl: { title: 'JSON-formatter en validator', description: 'Formatteer, valideer, inspecteer, converteer, kopieer en download JSON lokaal.', prettify: 'Opmaak verbeteren', minify: 'Verkleinen', yaml: 'YAML-indeling', csv: 'CSV', spaces: 'Spaties', treeView: 'Boomweergave', editorView: 'Editorweergave', copy: 'Kopiëren', download: 'Downloaden', input: 'JSON-invoer', output: 'Uitvoer', valid: 'Geldige JSON', invalid: 'Ongeldige JSON', line: 'regel', column: 'kolom', error: 'Fout' },
  pl: { title: 'Formatowanie i walidacja JSON', description: 'Formatuj, sprawdzaj, przeglądaj, konwertuj, kopiuj i pobieraj JSON lokalnie.', prettify: 'Upiększ', minify: 'Minimalizuj', yaml: 'Format YAML', csv: 'CSV', spaces: 'Spacje', treeView: 'Widok drzewa', editorView: 'Widok edytora', copy: 'Kopiuj', download: 'Pobierz', input: 'Wejście JSON', output: 'Wyjście', valid: 'Prawidłowy JSON', invalid: 'Nieprawidłowy JSON', line: 'wiersz', column: 'kolumna', error: 'Błąd' },
  tr: { title: 'JSON biçimlendirici ve doğrulayıcı', description: 'JSON verilerini tarayıcıda yerel olarak biçimlendirin, doğrulayın, inceleyin, dönüştürün, kopyalayın ve indirin.', prettify: 'Güzelleştir', minify: 'Küçült', yaml: 'YAML biçimi', csv: 'CSV', spaces: 'Boşluklar', treeView: 'Ağaç görünümü', editorView: 'Düzenleyici görünümü', copy: 'Kopyala', download: 'İndir', input: 'JSON girişi', output: 'Çıktı', valid: 'Geçerli JSON', invalid: 'Geçersiz JSON', line: 'satır', column: 'sütun', error: 'Hata' },
  vi: { title: 'Định dạng và xác thực JSON', description: 'Định dạng, xác thực, kiểm tra, chuyển đổi, sao chép và tải JSON cục bộ.', prettify: 'Làm đẹp', minify: 'Thu gọn', yaml: 'Định dạng YAML', csv: 'CSV', spaces: 'Khoảng trắng', treeView: 'Chế độ xem cây', editorView: 'Chế độ xem trình soạn thảo', copy: 'Sao chép', download: 'Tải xuống', input: 'Đầu vào JSON', output: 'Đầu ra', valid: 'JSON hợp lệ', invalid: 'JSON không hợp lệ', line: 'dòng', column: 'cột', error: 'Lỗi' },
  th: { title: 'จัดรูปแบบและตรวจสอบ JSON', description: 'จัดรูปแบบ ตรวจสอบ ตรวจดู แปลง คัดลอก และดาวน์โหลด JSON ในเบราว์เซอร์', prettify: 'จัดรูปแบบสวยงาม', minify: 'ย่อ', yaml: 'รูปแบบ YAML', csv: 'CSV', spaces: 'ช่องว่าง', treeView: 'มุมมองต้นไม้', editorView: 'มุมมองตัวแก้ไข', copy: 'คัดลอก', download: 'ดาวน์โหลด', input: 'อินพุต JSON', output: 'เอาต์พุต', valid: 'JSON ถูกต้อง', invalid: 'JSON ไม่ถูกต้อง', line: 'บรรทัด', column: 'คอลัมน์', error: 'ข้อผิดพลาด' },
  sv: { title: 'JSON-formaterare och validator', description: 'Formatera, validera, granska, konvertera, kopiera och ladda ner JSON lokalt.', prettify: 'Formatera', minify: 'Minifiera', yaml: 'YAML-format', csv: 'CSV', spaces: 'Mellanslag', treeView: 'Trädvy', editorView: 'Redigerarvy', copy: 'Kopiera', download: 'Ladda ner', input: 'JSON-inmatning', output: 'Utdata', valid: 'Giltig JSON', invalid: 'Ogiltig JSON', line: 'rad', column: 'kolumn', error: 'Fel' },
};

export function JsonFormatterValidatorTool() {
  const locale = normalizeLocale(typeof document === 'undefined' ? 'en' : document.documentElement.lang);
  const copy = COPY[locale];
  const [input, setInput] = useState(DEFAULT_JSON);
  const [output, setOutput] = useState(DEFAULT_JSON);
  const [spaces, setSpaces] = useState<2 | 4>(2);
  const [mode, setMode] = useState<'editor' | 'tree'>('editor');
  const [format, setFormat] = useState<'json' | 'yaml' | 'csv'>('json');
  const validation = useMemo(() => validateJson(input), [input]);
  const parsedValue = useMemo(() => validation.valid ? JSON.parse(input) as unknown : null, [input, validation.valid]);

  const run = (action: 'pretty' | 'minify' | 'yaml' | 'csv') => {
    if (!validation.valid) { setOutput(validation.error ?? copy.invalid); return; }
    try {
      if (action === 'pretty') { setOutput(formatJson(input, spaces)); setFormat('json'); }
      else if (action === 'minify') { setOutput(minifyJson(input)); setFormat('json'); }
      else if (action === 'yaml') { setOutput(toYaml(input)); setFormat('yaml'); }
      else {
        const csvInput = Array.isArray(parsedValue) ? input : JSON.stringify([parsedValue]);
        setOutput(toCsv(csvInput));
        setFormat('csv');
      }
    } catch (error) { setOutput(error instanceof Error ? error.message : copy.invalid); }
  };
  const copyOutput = async () => navigator.clipboard.writeText(output);
  const downloadOutput = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `flixo-output.${format}`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header><h1 className="text-3xl font-bold">{copy.title}</h1><p className="mt-2 opacity-80">{copy.description}</p></header>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => run('pretty')}>{copy.prettify}</button><button type="button" onClick={() => run('minify')}>{copy.minify}</button><button type="button" onClick={() => run('yaml')}>{copy.yaml}</button><button type="button" onClick={() => run('csv')}>{copy.csv}</button>
      <label className="flex items-center gap-2">{copy.spaces}<select value={spaces} onChange={(event) => setSpaces(Number(event.target.value) as 2 | 4)}><option value="2">2</option><option value="4">4</option></select></label>
      <button type="button" onClick={() => setMode((current) => current === 'editor' ? 'tree' : 'editor')}>{mode === 'editor' ? copy.treeView : copy.editorView}</button><button type="button" onClick={copyOutput}>{copy.copy}</button><button type="button" onClick={downloadOutput}>{copy.download}</button>
    </div>
    <section className="grid gap-6 md:grid-cols-2">
      <div><label htmlFor="json-input" className="mb-2 block font-semibold">{copy.input}</label><textarea id="json-input" aria-label={copy.input} className="min-h-[420px] w-full rounded border p-4 font-mono" value={input} onChange={(event) => setInput(event.target.value)} />{validation.valid ? <p className="mt-2 text-sm">{copy.valid}</p> : <p className="mt-2 text-sm">{copy.invalid}{validation.line ? ` — ${copy.line} ${validation.line}, ${copy.column} ${validation.column ?? 1}` : ''}: {validation.error}</p>}</div>
      <div><label htmlFor="json-output" className="mb-2 block font-semibold">{copy.output}</label><textarea id="json-output" aria-label={copy.output} className="min-h-[420px] w-full rounded border p-4 font-mono" readOnly value={output} />{mode === 'tree' && <div aria-label="JSON tree" className="mt-3 min-h-[120px] rounded border p-4">{parsedValue !== null ? <TreeNode value={buildJsonTree(parsedValue).value} /> : <p>{validation.error}</p>}</div>}</div>
    </section>
  </main>;
}
