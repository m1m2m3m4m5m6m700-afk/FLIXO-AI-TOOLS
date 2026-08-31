import { useMemo, useState } from 'react';
import { testRegex, type RegexFlags } from './engine';
import { normalizeLocale, type Locale } from '../../lib/i18n/config';

const defaults: RegexFlags = { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false };

type RegexCopy = {
  title: string;
  description: string;
  pattern: string;
  input: string;
  flag: Record<keyof RegexFlags, string>;
  match: (count: number) => string;
  index: string;
  group: string;
};

const COPY: Record<Locale, RegexCopy> = {
  en: { title: 'Regex Tester & Debugger', description: 'Test JavaScript regular expressions locally with live matches and capture groups.', pattern: 'Regex pattern', input: 'Regex input', flag: { global: 'global', ignoreCase: 'ignoreCase', multiline: 'multiline', dotAll: 'dotAll', unicode: 'unicode', sticky: 'sticky' }, match: (n) => `${n} match${n === 1 ? '' : 'es'}`, index: 'index', group: 'groups' },
  ar: { title: 'اختبار وتصحيح Regex', description: 'اختبر التعبيرات النمطية في JavaScript محليًا مع عرض المطابقات ومجموعات الالتقاط مباشرة.', pattern: 'نمط Regex', input: 'إدخال Regex', flag: { global: 'شامل', ignoreCase: 'تجاهل حالة الأحرف', multiline: 'متعدد الأسطر', dotAll: 'النقطة تشمل الأسطر', unicode: 'يونيكود', sticky: 'ملتصق' }, match: (n) => `${n} مطابقة`, index: 'الفهرس', group: 'المجموعات' },
  es: { title: 'Probador y depurador de Regex', description: 'Prueba expresiones regulares de JavaScript localmente con coincidencias y grupos de captura en vivo.', pattern: 'Patrón Regex', input: 'Entrada Regex', flag: { global: 'global', ignoreCase: 'ignorar mayúsculas', multiline: 'multilínea', dotAll: 'punto incluye saltos', unicode: 'Unicode', sticky: 'adhesivo' }, match: (n) => `${n} coincidencia${n === 1 ? '' : 's'}`, index: 'índice', group: 'grupos' },
  fr: { title: 'Testeur et débogueur Regex', description: 'Testez localement les expressions régulières JavaScript avec les correspondances et groupes capturés en direct.', pattern: 'Motif Regex', input: 'Entrée Regex', flag: { global: 'global', ignoreCase: 'ignorer la casse', multiline: 'multiligne', dotAll: 'point sur les retours', unicode: 'Unicode', sticky: 'persistant' }, match: (n) => `${n} correspondance${n === 1 ? '' : 's'}`, index: 'index', group: 'groupes' },
  de: { title: 'Regex-Tester und Debugger', description: 'Testen Sie JavaScript-reguläre Ausdrücke lokal mit Live-Treffern und Erfassungsgruppen.', pattern: 'Regex-Muster', input: 'Regex-Eingabe', flag: { global: 'global', ignoreCase: 'Groß-/Kleinschreibung ignorieren', multiline: 'mehrzeilig', dotAll: 'Punkt über Zeilen', unicode: 'Unicode', sticky: 'haftend' }, match: (n) => `${n} Treffer`, index: 'Index', group: 'Gruppen' },
  ru: { title: 'Тестер и отладчик Regex', description: 'Локально тестируйте регулярные выражения JavaScript с живыми совпадениями и группами захвата.', pattern: 'Шаблон Regex', input: 'Ввод Regex', flag: { global: 'глобальный', ignoreCase: 'игнорировать регистр', multiline: 'многострочный', dotAll: 'точка включает переносы', unicode: 'Unicode', sticky: 'фиксированный' }, match: (n) => `${n} совпадени${n % 10 === 1 && n % 100 !== 11 ? 'е' : 'й'}`, index: 'индекс', group: 'группы' },
  zh: { title: '正则表达式测试与调试', description: '在浏览器本地测试 JavaScript 正则表达式，并实时查看匹配项和捕获组。', pattern: '正则表达式模式', input: '正则输入', flag: { global: '全局', ignoreCase: '忽略大小写', multiline: '多行', dotAll: '点匹配换行', unicode: 'Unicode', sticky: '粘性' }, match: (n) => `${n} 个匹配项`, index: '索引', group: '分组' },
  hi: { title: 'Regex टेस्टर और डीबगर', description: 'JavaScript रेगुलर एक्सप्रेशन को ब्राउज़र में स्थानीय रूप से लाइव मैच और कैप्चर ग्रुप के साथ जाँचें।', pattern: 'Regex पैटर्न', input: 'Regex इनपुट', flag: { global: 'ग्लोबल', ignoreCase: 'केस अनदेखा', multiline: 'मल्टीलाइन', dotAll: 'डॉट लाइनब्रेक सहित', unicode: 'यूनिकोड', sticky: 'स्टिकी' }, match: (n) => `${n} मिलान`, index: 'इंडेक्स', group: 'ग्रुप' },
  id: { title: 'Penguji & Debugger Regex', description: 'Uji ekspresi reguler JavaScript secara lokal dengan kecocokan dan grup tangkapan langsung.', pattern: 'Pola Regex', input: 'Input Regex', flag: { global: 'global', ignoreCase: 'abaikan huruf besar', multiline: 'multibaris', dotAll: 'titik termasuk baris', unicode: 'Unicode', sticky: 'lengket' }, match: (n) => `${n} kecocokan`, index: 'indeks', group: 'grup' },
  ur: { title: 'Regex ٹیسٹر اور ڈیبگر', description: 'JavaScript ریگولر ایکسپریشنز کو براہ راست میچز اور کیپچر گروپس کے ساتھ مقامی طور پر آزمائیں۔', pattern: 'Regex پیٹرن', input: 'Regex اندراج', flag: { global: 'عالمی', ignoreCase: 'حروف کی حالت نظرانداز', multiline: 'متعدد سطری', dotAll: 'نقطہ نئی سطر شامل', unicode: 'یونیکوڈ', sticky: 'چسپاں' }, match: (n) => `${n} مماثلت`, index: 'اشاریہ', group: 'گروپس' },
  ja: { title: '正規表現テスター・デバッガー', description: 'JavaScript の正規表現をブラウザ上でローカルにテストし、マッチとキャプチャグループを確認します。', pattern: '正規表現パターン', input: '正規表現入力', flag: { global: 'グローバル', ignoreCase: '大文字小文字を無視', multiline: '複数行', dotAll: '改行にもドット', unicode: 'Unicode', sticky: 'スティッキー' }, match: (n) => `${n} 件の一致`, index: 'インデックス', group: 'グループ' },
  pt: { title: 'Testador e Depurador de Regex', description: 'Teste expressões regulares JavaScript localmente com correspondências e grupos de captura ao vivo.', pattern: 'Padrão Regex', input: 'Entrada Regex', flag: { global: 'global', ignoreCase: 'ignorar maiúsculas', multiline: 'multilinha', dotAll: 'ponto inclui quebras', unicode: 'Unicode', sticky: 'adesivo' }, match: (n) => `${n} correspondência${n === 1 ? '' : 's'}`, index: 'índice', group: 'grupos' },
  it: { title: 'Tester e debugger Regex', description: 'Prova le espressioni regolari JavaScript localmente con corrispondenze e gruppi catturati in tempo reale.', pattern: 'Schema Regex', input: 'Input Regex', flag: { global: 'globale', ignoreCase: 'ignora maiuscole', multiline: 'multiriga', dotAll: 'punto sulle righe', unicode: 'Unicode', sticky: 'persistente' }, match: (n) => `${n} corrispondenz${n === 1 ? 'a' : 'e'}`, index: 'indice', group: 'gruppi' },
  ko: { title: '정규식 테스트 및 디버거', description: '브라우저에서 JavaScript 정규식을 로컬로 테스트하고 일치 항목과 캡처 그룹을 실시간으로 확인합니다.', pattern: '정규식 패턴', input: '정규식 입력', flag: { global: '전역', ignoreCase: '대소문자 무시', multiline: '여러 줄', dotAll: '줄바꿈 포함 점', unicode: '유니코드', sticky: '고정' }, match: (n) => `${n}개 일치`, index: '인덱스', group: '그룹' },
  nl: { title: 'Regex-tester en debugger', description: 'Test JavaScript-regexen lokaal met live overeenkomsten en vanggroepen.', pattern: 'Regex-patroon', input: 'Regex-invoer', flag: { global: 'globaal', ignoreCase: 'hoofdletters negeren', multiline: 'meerdere regels', dotAll: 'punt over regels', unicode: 'Unicode', sticky: 'plakkerig' }, match: (n) => `${n} overeenkomst${n === 1 ? '' : 'en'}`, index: 'index', group: 'groepen' },
  pl: { title: 'Tester i debugger Regex', description: 'Testuj wyrażenia regularne JavaScript lokalnie, korzystając z podglądu dopasowań i grup przechwytujących.', pattern: 'Wzorzec Regex', input: 'Wejście Regex', flag: { global: 'globalny', ignoreCase: 'ignoruj wielkość liter', multiline: 'wielowierszowy', dotAll: 'kropka także dla końca linii', unicode: 'Unicode', sticky: 'lepki' }, match: (n) => `${n} dopasowań`, index: 'indeks', group: 'grupy' },
  tr: { title: 'Regex test ve hata ayıklama', description: 'JavaScript düzenli ifadelerini tarayıcıda eşleşmeler ve yakalama gruplarıyla yerel olarak test edin.', pattern: 'Regex deseni', input: 'Regex girişi', flag: { global: 'global', ignoreCase: 'büyük/küçük harfi yoksay', multiline: 'çok satırlı', dotAll: 'nokta satır sonlarında', unicode: 'Unicode', sticky: 'yapışkan' }, match: (n) => `${n} eşleşme`, index: 'indeks', group: 'gruplar' },
  vi: { title: 'Trình kiểm tra và gỡ lỗi Regex', description: 'Kiểm tra biểu thức chính quy JavaScript cục bộ với các kết quả khớp và nhóm bắt trực tiếp.', pattern: 'Mẫu Regex', input: 'Đầu vào Regex', flag: { global: 'toàn cục', ignoreCase: 'bỏ qua hoa thường', multiline: 'nhiều dòng', dotAll: 'dấu chấm qua dòng', unicode: 'Unicode', sticky: 'dính' }, match: (n) => `${n} kết quả khớp`, index: 'chỉ mục', group: 'nhóm' },
  th: { title: 'ทดสอบและแก้ไข Regex', description: 'ทดสอบนิพจน์ทั่วไปของ JavaScript ในเบราว์เซอร์ภายในเครื่อง พร้อมดูผลลัพธ์และกลุ่มจับแบบสด', pattern: 'รูปแบบ Regex', input: 'อินพุต Regex', flag: { global: 'ทั่วโลก', ignoreCase: 'ไม่สนใจตัวพิมพ์', multiline: 'หลายบรรทัด', dotAll: 'จุดรวมการขึ้นบรรทัด', unicode: 'ยูนิโค้ด', sticky: 'ยึดติด' }, match: (n) => `${n} รายการที่ตรงกัน`, index: 'ดัชนี', group: 'กลุ่ม' },
  sv: { title: 'Regex-testare och debugger', description: 'Testa JavaScript-reguljära uttryck lokalt med direkta träffar och fångstgrupper.', pattern: 'Regex-mönster', input: 'Regex-inmatning', flag: { global: 'global', ignoreCase: 'ignorera versaler', multiline: 'flera rader', dotAll: 'punkt över radbrytningar', unicode: 'Unicode', sticky: 'klistrig' }, match: (n) => `${n} träff${n === 1 ? '' : 'ar'}`, index: 'index', group: 'grupper' },
};

export function RegexTesterTool() {
  const locale = normalizeLocale(typeof document === 'undefined' ? 'en' : document.documentElement.lang);
  const copy = COPY[locale];
  const [pattern, setPattern] = useState('\\b\\w+\\b');
  const [input, setInput] = useState('FLIXO Regex Tester');
  const [flags, setFlags] = useState<RegexFlags>(defaults);
  const result = useMemo(() => testRegex(pattern, input, flags), [pattern, input, flags]);
  const toggle = (key: keyof RegexFlags) => setFlags((current) => ({ ...current, [key]: !current[key] }));

  return <section className="mx-auto max-w-4xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">{copy.title}</h1><p className="text-sm opacity-70">{copy.description}</p></header>
    <input className="w-full rounded border p-3 font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label={copy.pattern} />
    <div className="flex flex-wrap gap-3 text-sm">{(Object.keys(flags) as Array<keyof RegexFlags>).map((key) => <label key={key} className="inline-flex items-center gap-2"><input type="checkbox" checked={flags[key]} onChange={() => toggle(key)} />{copy.flag[key]}</label>)}</div>
    <textarea className="min-h-48 w-full rounded border p-3" value={input} onChange={(e) => setInput(e.target.value)} aria-label={copy.input} />
    {result.error ? <p role="alert" className="rounded border p-3">{result.error}</p> : <div className="space-y-3"><p aria-live="polite">{copy.match(result.matches.length)}</p>{result.matches.map((match, index) => <div key={`${match.index}-${index}`} className="rounded border p-3 font-mono text-sm">#{index + 1} • {copy.index} {match.index} • {JSON.stringify(match.text)}{match.groups.length > 0 && <div className="mt-1 opacity-70">{copy.group}: {JSON.stringify(match.groups)}</div>}</div>)}</div>}
  </section>;
}
