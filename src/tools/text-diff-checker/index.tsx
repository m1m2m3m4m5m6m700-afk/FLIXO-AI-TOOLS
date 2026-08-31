import { useMemo, useState } from 'react';
import { diffSummary, diffText, type DiffKind } from './engine';
import { normalizeLocale, type Locale } from '../../lib/i18n/config';

const styles: Record<DiffKind, string> = { equal: '', added: 'bg-green-200/40', removed: 'bg-red-200/40 line-through' };

type DiffCopy = { title: string; description: string; original: string; modified: string; originalAria: string; modifiedAria: string; ignore: string; mode: string; inline: string; side: string; copy: string; summary: string };
const COPY: Record<Locale, DiffCopy> = {
  en:{title:'Text Diff Checker',description:'Compare two texts locally with inline or side-by-side differences.',original:'Original',modified:'Modified',originalAria:'Original text',modifiedAria:'Modified text',ignore:'Ignore whitespace',mode:'Diff view mode',inline:'Inline',side:'Side-by-side',copy:'Copy summary',summary:'Diff summary'},
  ar:{title:'مدقق اختلاف النصوص',description:'قارن نصين محليًا مع عرض الفروقات مضمّنة أو جنبًا إلى جنب.',original:'النص الأصلي',modified:'النص المعدّل',originalAria:'النص الأصلي',modifiedAria:'النص المعدّل',ignore:'تجاهل المسافات البيضاء',mode:'وضع عرض الفروقات',inline:'مضمّن',side:'جنبًا إلى جنب',copy:'نسخ الملخص',summary:'ملخص الفروقات'},
  es:{title:'Comparador de diferencias de texto',description:'Compara dos textos localmente con diferencias en línea o lado a lado.',original:'Original',modified:'Modificado',originalAria:'Texto original',modifiedAria:'Texto modificado',ignore:'Ignorar espacios',mode:'Modo de vista de diferencias',inline:'En línea',side:'Lado a lado',copy:'Copiar resumen',summary:'Resumen de diferencias'},
  fr:{title:'Comparateur de différences de texte',description:'Comparez deux textes localement avec les différences en ligne ou côte à côte.',original:'Original',modified:'Modifié',originalAria:'Texte original',modifiedAria:'Texte modifié',ignore:'Ignorer les espaces',mode:'Mode d’affichage des différences',inline:'En ligne',side:'Côte à côte',copy:'Copier le résumé',summary:'Résumé des différences'},
  de:{title:'Text-Diff-Prüfer',description:'Vergleichen Sie zwei Texte lokal mit Inline- oder Nebeneinander-Differenzen.',original:'Original',modified:'Geändert',originalAria:'Originaltext',modifiedAria:'Geänderter Text',ignore:'Leerzeichen ignorieren',mode:'Diff-Ansichtsmodus',inline:'Inline',side:'Nebeneinander',copy:'Zusammenfassung kopieren',summary:'Diff-Zusammenfassung'},
  ru:{title:'Сравнение текстов',description:'Сравнивайте два текста локально с различиями в строке или рядом.',original:'Оригинал',modified:'Изменённый',originalAria:'Исходный текст',modifiedAria:'Изменённый текст',ignore:'Игнорировать пробелы',mode:'Режим просмотра различий',inline:'В строке',side:'Рядом',copy:'Копировать сводку',summary:'Сводка различий'},
  zh:{title:'文本差异检查器',description:'在本地比较两个文本，以内联或并排方式查看差异。',original:'原始文本',modified:'修改后文本',originalAria:'原始文本',modifiedAria:'修改后文本',ignore:'忽略空白',mode:'差异查看模式',inline:'内联',side:'并排',copy:'复制摘要',summary:'差异摘要'},
  hi:{title:'टेक्स्ट डिफ़ चेककर',description:'दो टेक्स्ट की तुलना स्थानीय रूप से करें और इनलाइन या साथ-साथ अंतर देखें।',original:'मूल',modified:'संशोधित',originalAria:'मूल टेक्स्ट',modifiedAria:'संशोधित टेक्स्ट',ignore:'व्हाइटस्पेस अनदेखा करें',mode:'डिफ़ दृश्य मोड',inline:'इनलाइन',side:'साथ-साथ',copy:'सारांश कॉपी करें',summary:'डिफ़ सारांश'},
  id:{title:'Pemeriksa Perbedaan Teks',description:'Bandingkan dua teks secara lokal dengan perbedaan sebaris atau berdampingan.',original:'Asli',modified:'Diubah',originalAria:'Teks asli',modifiedAria:'Teks yang diubah',ignore:'Abaikan spasi',mode:'Mode tampilan perbedaan',inline:'Sebaris',side:'Berdampingan',copy:'Salin ringkasan',summary:'Ringkasan perbedaan'},
  ur:{title:'متن کے فرق کا معائنہ کار',description:'دو متن کا مقامی طور پر موازنہ کریں اور اندرونی یا ساتھ ساتھ فرق دیکھیں۔',original:'اصل',modified:'ترمیم شدہ',originalAria:'اصل متن',modifiedAria:'ترمیم شدہ متن',ignore:'خالی جگہوں کو نظرانداز کریں',mode:'فرق دکھانے کا طریقہ',inline:'ان لائن',side:'ساتھ ساتھ',copy:'خلاصہ کاپی کریں',summary:'فرق کا خلاصہ'},
  ja:{title:'テキスト差分チェッカー',description:'2つのテキストをローカルで比較し、インラインまたは左右の差分を表示します。',original:'元のテキスト',modified:'変更後',originalAria:'元のテキスト',modifiedAria:'変更後のテキスト',ignore:'空白を無視',mode:'差分表示モード',inline:'インライン',side:'左右',copy:'概要をコピー',summary:'差分概要'},
  pt:{title:'Comparador de diferenças de texto',description:'Compare dois textos localmente com diferenças em linha ou lado a lado.',original:'Original',modified:'Modificado',originalAria:'Texto original',modifiedAria:'Texto modificado',ignore:'Ignorar espaços',mode:'Modo de visualização das diferenças',inline:'Em linha',side:'Lado a lado',copy:'Copiar resumo',summary:'Resumo das diferenças'},
  it:{title:'Controllo differenze testo',description:'Confronta due testi localmente con differenze in linea o affiancate.',original:'Originale',modified:'Modificato',originalAria:'Testo originale',modifiedAria:'Testo modificato',ignore:'Ignora spazi',mode:'Modalità visualizzazione differenze',inline:'In linea',side:'Affiancato',copy:'Copia riepilogo',summary:'Riepilogo differenze'},
  ko:{title:'텍스트 차이 검사기',description:'두 텍스트를 로컬에서 비교하고 인라인 또는 나란히 차이를 확인합니다.',original:'원본',modified:'수정됨',originalAria:'원본 텍스트',modifiedAria:'수정된 텍스트',ignore:'공백 무시',mode:'차이 보기 모드',inline:'인라인',side:'나란히',copy:'요약 복사',summary:'차이 요약'},
  nl:{title:'Tekstverschillenchecker',description:'Vergelijk lokaal twee teksten met inline of naast elkaar weergegeven verschillen.',original:'Origineel',modified:'Gewijzigd',originalAria:'Originele tekst',modifiedAria:'Gewijzigde tekst',ignore:'Spaties negeren',mode:'Weergavemodus verschillen',inline:'Inline',side:'Naast elkaar',copy:'Samenvatting kopiëren',summary:'Samenvatting verschillen'},
  pl:{title:'Porównywarka tekstu',description:'Porównuj lokalnie dwa teksty z różnicami w linii lub obok siebie.',original:'Oryginał',modified:'Zmodyfikowany',originalAria:'Tekst oryginalny',modifiedAria:'Tekst zmodyfikowany',ignore:'Ignoruj białe znaki',mode:'Tryb widoku różnic',inline:'W linii',side:'Obok siebie',copy:'Kopiuj podsumowanie',summary:'Podsumowanie różnic'},
  tr:{title:'Metin farkı denetleyici',description:'İki metni yerel olarak satır içi veya yan yana farklarla karşılaştırın.',original:'Orijinal',modified:'Değiştirilmiş',originalAria:'Orijinal metin',modifiedAria:'Değiştirilmiş metin',ignore:'Boşlukları yoksay',mode:'Fark görünümü modu',inline:'Satır içi',side:'Yan yana',copy:'Özeti kopyala',summary:'Fark özeti'},
  vi:{title:'Trình kiểm tra khác biệt văn bản',description:'So sánh hai văn bản cục bộ với khác biệt nội tuyến hoặc song song.',original:'Bản gốc',modified:'Đã sửa đổi',originalAria:'Văn bản gốc',modifiedAria:'Văn bản đã sửa đổi',ignore:'Bỏ qua khoảng trắng',mode:'Chế độ xem khác biệt',inline:'Nội tuyến',side:'Song song',copy:'Sao chép tóm tắt',summary:'Tóm tắt khác biệt'},
  th:{title:'เครื่องมือตรวจความแตกต่างของข้อความ',description:'เปรียบเทียบข้อความสองชุดในเครื่องพร้อมแสดงความแตกต่างแบบแทรกหรือแบบเคียงข้างกัน',original:'ต้นฉบับ',modified:'แก้ไขแล้ว',originalAria:'ข้อความต้นฉบับ',modifiedAria:'ข้อความที่แก้ไขแล้ว',ignore:'ละเว้นช่องว่าง',mode:'โหมดการแสดงความแตกต่าง',inline:'ในบรรทัด',side:'เคียงข้าง',copy:'คัดลอกสรุป',summary:'สรุปความแตกต่าง'},
  sv:{title:'Textskillnadskontroll',description:'Jämför två texter lokalt med skillnader inline eller sida vid sida.',original:'Original',modified:'Ändrad',originalAria:'Originaltext',modifiedAria:'Ändrad text',ignore:'Ignorera blanksteg',mode:'Visningsläge för skillnader',inline:'Inline',side:'Sida vid sida',copy:'Kopiera sammanfattning',summary:'Sammanfattning av skillnader'},
};

export function TextDiffCheckerTool() {
  const locale = normalizeLocale(typeof document === 'undefined' ? 'en' : document.documentElement.lang);
  const copy = COPY[locale];
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [mode, setMode] = useState<'inline' | 'side-by-side'>('inline');
  const result = useMemo(() => diffText(original, modified, ignoreWhitespace), [original, modified, ignoreWhitespace]);
  const copySummary = async () => navigator.clipboard.writeText(diffSummary(result));

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" aria-labelledby="text-diff-title">
      <header><h1 id="text-diff-title" className="text-3xl font-bold">{copy.title}</h1><p className="mt-2 text-sm opacity-75">{copy.description}</p></header>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2"><span>{copy.original}</span><textarea aria-label={copy.originalAria} value={original} onChange={(e) => setOriginal(e.target.value)} className="min-h-64 rounded-2xl border p-4" /></label>
        <label className="flex flex-col gap-2"><span>{copy.modified}</span><textarea aria-label={copy.modifiedAria} value={modified} onChange={(e) => setModified(e.target.value)} className="min-h-64 rounded-2xl border p-4" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} /> {copy.ignore}</label>
        <div className="flex gap-2" role="group" aria-label={copy.mode}>
          <button type="button" className="rounded-xl border px-3 py-2" aria-pressed={mode === 'inline'} onClick={() => setMode('inline')}>{copy.inline}</button>
          <button type="button" className="rounded-xl border px-3 py-2" aria-pressed={mode === 'side-by-side'} onClick={() => setMode('side-by-side')}>{copy.side}</button>
        </div>
        <button type="button" className="rounded-xl border px-3 py-2" onClick={copySummary}>{copy.copy}</button>
      </div>
      <div data-testid="diff-summary" aria-label={copy.summary} className="rounded-2xl border p-4">{diffSummary(result)}</div>
      {mode === 'inline' ? (
        <div aria-label={copy.inline} className="whitespace-pre-wrap rounded-2xl border p-4 leading-7">
          {result.parts.map((part, index) => <span key={`${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div aria-label={copy.original} className="whitespace-pre-wrap rounded-2xl border p-4">{result.parts.filter((p) => p.kind !== 'added').map((part, index) => <span key={`o-${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}</div>
          <div aria-label={copy.modified} className="whitespace-pre-wrap rounded-2xl border p-4">{result.parts.filter((p) => p.kind !== 'removed').map((part, index) => <span key={`m-${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}</div>
        </div>
      )}
    </section>
  );
}
