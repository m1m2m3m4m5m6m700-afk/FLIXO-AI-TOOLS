import { useEffect, useMemo, useState } from 'react';
import { getReadyToolConfigs } from '../config/tools';
import { addToolToChain, clearToolChain, getToolChain, moveToolInChain, removeToolFromChain } from '../lib/tool-chain';
import type { Locale } from '../lib/i18n';
import './tool-chain-panel.css';

type ChainCopy = Readonly<{
  aria: string; title: string; steps: string; open: string; hide: string; add: string; clear: string; empty: string;
  input: string; processing: string; run: string; current: string; output: string; download: string; contract: string;
  localOnly: string; unsupported: string; moveUp: string; moveDown: string; remove: string;
}>;

const COPY: Record<string, ChainCopy> = {
  ar: { aria: 'مساحة سلسلة الأدوات', title: 'سلسلة الأدوات', steps: 'خطوات', open: 'فتح', hide: 'إخفاء', add: '+ إضافة الأداة الحالية', clear: 'مسح', empty: 'أضف الأدوات بالترتيب الذي تريد معالجة الملفات به. تُخزَّن السلسلة في هذا المتصفح فقط.', input: 'ملف الإدخال', processing: 'جارٍ المعالجة…', run: 'تشغيل السلسلة محليًا', current: 'الخطوة الحالية', output: 'الناتج جاهز', download: 'تنزيل النتيجة', contract: 'عقد التنفيذ', localOnly: 'المحوّلات المحلية فقط.', unsupported: 'الخطوات غير المدعومة تفشل صراحةً؛ لا ترفع سلسلة الأدوات أي ملف.', moveUp: 'تحريك {title} لأعلى', moveDown: 'تحريك {title} لأسفل', remove: 'إزالة {title}' },
  en: { aria: 'Tool chaining workspace', title: 'Tool Chain', steps: 'steps', open: 'Open', hide: 'Hide', add: '+ Add current tool', clear: 'Clear', empty: 'Add tools in the order you want to process them. The chain is stored only in this browser.', input: 'Input file', processing: 'Processing…', run: 'Run chain locally', current: 'Current step', output: 'Output ready', download: 'Download result', contract: 'Execution contract', localOnly: 'local adapters only.', unsupported: 'Unsupported steps fail explicitly; no file is uploaded by the chain runner.', moveUp: 'Move {title} up', moveDown: 'Move {title} down', remove: 'Remove {title}' },
  es: { aria: 'Espacio de cadena de herramientas', title: 'Cadena de herramientas', steps: 'pasos', open: 'Abrir', hide: 'Ocultar', add: '+ Añadir herramienta actual', clear: 'Borrar', empty: 'Añade herramientas en el orden en que quieras procesarlas. La cadena se guarda solo en este navegador.', input: 'Archivo de entrada', processing: 'Procesando…', run: 'Ejecutar cadena localmente', current: 'Paso actual', output: 'Resultado listo', download: 'Descargar resultado', contract: 'Contrato de ejecución', localOnly: 'solo adaptadores locales.', unsupported: 'Los pasos no compatibles fallan explícitamente; la cadena no sube ningún archivo.', moveUp: 'Mover {title} arriba', moveDown: 'Mover {title} abajo', remove: 'Quitar {title}' },
  fr: { aria: 'Espace de chaîne d’outils', title: 'Chaîne d’outils', steps: 'étapes', open: 'Ouvrir', hide: 'Masquer', add: '+ Ajouter l’outil actuel', clear: 'Effacer', empty: 'Ajoutez les outils dans l’ordre de traitement souhaité. La chaîne reste uniquement dans ce navigateur.', input: 'Fichier d’entrée', processing: 'Traitement…', run: 'Exécuter la chaîne localement', current: 'Étape actuelle', output: 'Résultat prêt', download: 'Télécharger le résultat', contract: 'Contrat d’exécution', localOnly: 'adaptateurs locaux uniquement.', unsupported: 'Les étapes non prises en charge échouent explicitement ; aucun fichier n’est envoyé.', moveUp: 'Monter {title}', moveDown: 'Descendre {title}', remove: 'Supprimer {title}' },
  de: { aria: 'Arbeitsbereich der Toolkette', title: 'Toolkette', steps: 'Schritte', open: 'Öffnen', hide: 'Ausblenden', add: '+ Aktuelles Tool hinzufügen', clear: 'Löschen', empty: 'Fügen Sie die Tools in der gewünschten Reihenfolge hinzu. Die Kette wird nur in diesem Browser gespeichert.', input: 'Eingabedatei', processing: 'Wird verarbeitet…', run: 'Kette lokal ausführen', current: 'Aktueller Schritt', output: 'Ausgabe bereit', download: 'Ergebnis herunterladen', contract: 'Ausführungsvertrag', localOnly: 'nur lokale Adapter.', unsupported: 'Nicht unterstützte Schritte schlagen ausdrücklich fehl; es wird keine Datei hochgeladen.', moveUp: '{title} nach oben', moveDown: '{title} nach unten', remove: '{title} entfernen' },
  hi: { aria: 'टूल चेन कार्यक्षेत्र', title: 'टूल चेन', steps: 'चरण', open: 'खोलें', hide: 'छिपाएँ', add: '+ वर्तमान टूल जोड़ें', clear: 'साफ़ करें', empty: 'टूल को उस क्रम में जोड़ें जिसमें आप उन्हें प्रोसेस करना चाहते हैं। चेन केवल इस ब्राउज़र में संग्रहीत होती है।', input: 'इनपुट फ़ाइल', processing: 'प्रोसेस हो रहा है…', run: 'चेन स्थानीय रूप से चलाएँ', current: 'वर्तमान चरण', output: 'आउटपुट तैयार', download: 'परिणाम डाउनलोड करें', contract: 'निष्पादन अनुबंध', localOnly: 'केवल स्थानीय एडेप्टर।', unsupported: 'असमर्थित चरण स्पष्ट रूप से विफल होते हैं; कोई फ़ाइल अपलोड नहीं होती।', moveUp: '{title} ऊपर ले जाएँ', moveDown: '{title} नीचे ले जाएँ', remove: '{title} हटाएँ' },
  id: { aria: 'Ruang kerja rantai alat', title: 'Rantai alat', steps: 'langkah', open: 'Buka', hide: 'Sembunyikan', add: '+ Tambahkan alat saat ini', clear: 'Bersihkan', empty: 'Tambahkan alat sesuai urutan pemrosesan yang diinginkan. Rantai hanya disimpan di browser ini.', input: 'File masukan', processing: 'Memproses…', run: 'Jalankan rantai secara lokal', current: 'Langkah saat ini', output: 'Hasil siap', download: 'Unduh hasil', contract: 'Kontrak eksekusi', localOnly: 'hanya adaptor lokal.', unsupported: 'Langkah yang tidak didukung gagal secara eksplisit; tidak ada file yang diunggah.', moveUp: 'Pindahkan {title} ke atas', moveDown: 'Pindahkan {title} ke bawah', remove: 'Hapus {title}' },
  it: { aria: 'Area della catena di strumenti', title: 'Catena di strumenti', steps: 'passaggi', open: 'Apri', hide: 'Nascondi', add: '+ Aggiungi strumento corrente', clear: 'Cancella', empty: 'Aggiungi gli strumenti nell’ordine desiderato. La catena viene salvata solo in questo browser.', input: 'File di input', processing: 'Elaborazione…', run: 'Esegui catena localmente', current: 'Passaggio corrente', output: 'Output pronto', download: 'Scarica risultato', contract: 'Contratto di esecuzione', localOnly: 'solo adattatori locali.', unsupported: 'I passaggi non supportati falliscono esplicitamente; nessun file viene caricato.', moveUp: 'Sposta {title} su', moveDown: 'Sposta {title} giù', remove: 'Rimuovi {title}' },
  ja: { aria: 'ツールチェーンのワークスペース', title: 'ツールチェーン', steps: 'ステップ', open: '開く', hide: '隠す', add: '+ 現在のツールを追加', clear: 'クリア', empty: '処理したい順にツールを追加します。チェーンはこのブラウザ内だけに保存されます。', input: '入力ファイル', processing: '処理中…', run: 'チェーンをローカルで実行', current: '現在のステップ', output: '出力の準備完了', download: '結果をダウンロード', contract: '実行コントラクト', localOnly: 'ローカルアダプターのみ。', unsupported: '未対応のステップは明示的に失敗し、ファイルはアップロードされません。', moveUp: '{title} を上へ', moveDown: '{title} を下へ', remove: '{title} を削除' },
  ko: { aria: '도구 체인 작업 공간', title: '도구 체인', steps: '단계', open: '열기', hide: '숨기기', add: '+ 현재 도구 추가', clear: '지우기', empty: '처리할 순서대로 도구를 추가하세요. 체인은 이 브라우저에만 저장됩니다.', input: '입력 파일', processing: '처리 중…', run: '체인을 로컬에서 실행', current: '현재 단계', output: '출력 준비 완료', download: '결과 다운로드', contract: '실행 계약', localOnly: '로컬 어댑터만 사용합니다.', unsupported: '지원되지 않는 단계는 명시적으로 실패하며 파일은 업로드되지 않습니다.', moveUp: '{title} 위로 이동', moveDown: '{title} 아래로 이동', remove: '{title} 제거' },
  ms: { aria: 'Ruang kerja rantaian alat', title: 'Rantaian alat', steps: 'langkah', open: 'Buka', hide: 'Sembunyi', add: '+ Tambah alat semasa', clear: 'Kosongkan', empty: 'Tambah alat mengikut susunan pemprosesan yang dikehendaki. Rantaian hanya disimpan dalam pelayar ini.', input: 'Fail input', processing: 'Memproses…', run: 'Jalankan rantaian secara setempat', current: 'Langkah semasa', output: 'Output sedia', download: 'Muat turun hasil', contract: 'Kontrak pelaksanaan', localOnly: 'penyesuai tempatan sahaja.', unsupported: 'Langkah yang tidak disokong gagal dengan jelas; tiada fail dimuat naik.', moveUp: 'Alih {title} ke atas', moveDown: 'Alih {title} ke bawah', remove: 'Buang {title}' },
  nl: { aria: 'Werkruimte voor toolketen', title: 'Toolketen', steps: 'stappen', open: 'Openen', hide: 'Verbergen', add: '+ Huidige tool toevoegen', clear: 'Wissen', empty: 'Voeg tools toe in de gewenste verwerkingsvolgorde. De keten wordt alleen in deze browser opgeslagen.', input: 'Invoerbestand', processing: 'Verwerken…', run: 'Keten lokaal uitvoeren', current: 'Huidige stap', output: 'Uitvoer gereed', download: 'Resultaat downloaden', contract: 'Uitvoeringscontract', localOnly: 'alleen lokale adapters.', unsupported: 'Niet-ondersteunde stappen mislukken expliciet; er wordt geen bestand geüpload.', moveUp: '{title} omhoog', moveDown: '{title} omlaag', remove: '{title} verwijderen' },
  pl: { aria: 'Obszar łańcucha narzędzi', title: 'Łańcuch narzędzi', steps: 'kroków', open: 'Otwórz', hide: 'Ukryj', add: '+ Dodaj bieżące narzędzie', clear: 'Wyczyść', empty: 'Dodaj narzędzia w kolejności przetwarzania. Łańcuch jest przechowywany tylko w tej przeglądarce.', input: 'Plik wejściowy', processing: 'Przetwarzanie…', run: 'Uruchom łańcuch lokalnie', current: 'Bieżący krok', output: 'Wynik gotowy', download: 'Pobierz wynik', contract: 'Kontrakt wykonania', localOnly: 'tylko lokalne adaptery.', unsupported: 'Nieobsługiwane kroki jawnie kończą się błędem; plik nie jest przesyłany.', moveUp: 'Przesuń {title} w górę', moveDown: 'Przesuń {title} w dół', remove: 'Usuń {title}' },
  pt: { aria: 'Área da cadeia de ferramentas', title: 'Cadeia de ferramentas', steps: 'etapas', open: 'Abrir', hide: 'Ocultar', add: '+ Adicionar ferramenta atual', clear: 'Limpar', empty: 'Adicione as ferramentas na ordem de processamento desejada. A cadeia fica armazenada apenas neste navegador.', input: 'Ficheiro de entrada', processing: 'A processar…', run: 'Executar cadeia localmente', current: 'Etapa atual', output: 'Resultado pronto', download: 'Transferir resultado', contract: 'Contrato de execução', localOnly: 'apenas adaptadores locais.', unsupported: 'As etapas não suportadas falham explicitamente; nenhum ficheiro é enviado.', moveUp: 'Mover {title} para cima', moveDown: 'Mover {title} para baixo', remove: 'Remover {title}' },
  ru: { aria: 'Рабочая область цепочки инструментов', title: 'Цепочка инструментов', steps: 'шагов', open: 'Открыть', hide: 'Скрыть', add: '+ Добавить текущий инструмент', clear: 'Очистить', empty: 'Добавьте инструменты в нужном порядке обработки. Цепочка хранится только в этом браузере.', input: 'Входной файл', processing: 'Обработка…', run: 'Запустить цепочку локально', current: 'Текущий шаг', output: 'Результат готов', download: 'Скачать результат', contract: 'Контракт выполнения', localOnly: 'только локальные адаптеры.', unsupported: 'Неподдерживаемые шаги явно завершаются ошибкой; файл не загружается.', moveUp: 'Переместить {title} вверх', moveDown: 'Переместить {title} вниз', remove: 'Удалить {title}' },
  sv: { aria: 'Arbetsyta för verktygskedja', title: 'Verktygskedja', steps: 'steg', open: 'Öppna', hide: 'Dölj', add: '+ Lägg till aktuellt verktyg', clear: 'Rensa', empty: 'Lägg till verktyg i den ordning du vill bearbeta dem. Kedjan sparas bara i den här webbläsaren.', input: 'Indatafil', processing: 'Bearbetar…', run: 'Kör kedjan lokalt', current: 'Aktuellt steg', output: 'Utdata klar', download: 'Ladda ner resultatet', contract: 'Körningskontrakt', localOnly: 'endast lokala adaptrar.', unsupported: 'Ostödda steg misslyckas uttryckligen; ingen fil laddas upp.', moveUp: 'Flytta {title} upp', moveDown: 'Flytta {title} ned', remove: 'Ta bort {title}' },
  th: { aria: 'พื้นที่โซ่เครื่องมือ', title: 'โซ่เครื่องมือ', steps: 'ขั้นตอน', open: 'เปิด', hide: 'ซ่อน', add: '+ เพิ่มเครื่องมือปัจจุบัน', clear: 'ล้าง', empty: 'เพิ่มเครื่องมือตามลำดับที่ต้องการประมวลผล โซ่จะถูกเก็บไว้เฉพาะในเบราว์เซอร์นี้', input: 'ไฟล์อินพุต', processing: 'กำลังประมวลผล…', run: 'เรียกใช้โซ่ในเครื่อง', current: 'ขั้นตอนปัจจุบัน', output: 'ผลลัพธ์พร้อมใช้', download: 'ดาวน์โหลดผลลัพธ์', contract: 'สัญญาการทำงาน', localOnly: 'ใช้อะแดปเตอร์ภายในเครื่องเท่านั้น', unsupported: 'ขั้นตอนที่ไม่รองรับจะล้มเหลวอย่างชัดเจน และจะไม่มีการอัปโหลดไฟล์', moveUp: 'เลื่อน {title} ขึ้น', moveDown: 'เลื่อน {title} ลง', remove: 'ลบ {title}' },
  tr: { aria: 'Araç zinciri çalışma alanı', title: 'Araç zinciri', steps: 'adım', open: 'Aç', hide: 'Gizle', add: '+ Geçerli aracı ekle', clear: 'Temizle', empty: 'Araçları işlemek istediğiniz sırayla ekleyin. Zincir yalnızca bu tarayıcıda saklanır.', input: 'Girdi dosyası', processing: 'İşleniyor…', run: 'Zinciri yerel çalıştır', current: 'Geçerli adım', output: 'Çıktı hazır', download: 'Sonucu indir', contract: 'Yürütme sözleşmesi', localOnly: 'yalnızca yerel bağdaştırıcılar.', unsupported: 'Desteklenmeyen adımlar açıkça başarısız olur; hiçbir dosya yüklenmez.', moveUp: '{title} yukarı taşı', moveDown: '{title} aşağı taşı', remove: '{title} kaldır' },
  uk: { aria: 'Робоча область ланцюжка інструментів', title: 'Ланцюжок інструментів', steps: 'кроків', open: 'Відкрити', hide: 'Сховати', add: '+ Додати поточний інструмент', clear: 'Очистити', empty: 'Додавайте інструменти в потрібному порядку обробки. Ланцюжок зберігається лише в цьому браузері.', input: 'Вхідний файл', processing: 'Обробка…', run: 'Запустити ланцюжок локально', current: 'Поточний крок', output: 'Результат готовий', download: 'Завантажити результат', contract: 'Контракт виконання', localOnly: 'лише локальні адаптери.', unsupported: 'Непідтримувані кроки явно завершуються помилкою; файл не завантажується.', moveUp: 'Перемістити {title} вгору', moveDown: 'Перемістити {title} вниз', remove: 'Видалити {title}' },
  vi: { aria: 'Không gian chuỗi công cụ', title: 'Chuỗi công cụ', steps: 'bước', open: 'Mở', hide: 'Ẩn', add: '+ Thêm công cụ hiện tại', clear: 'Xóa', empty: 'Thêm các công cụ theo thứ tự bạn muốn xử lý. Chuỗi chỉ được lưu trong trình duyệt này.', input: 'Tệp đầu vào', processing: 'Đang xử lý…', run: 'Chạy chuỗi cục bộ', current: 'Bước hiện tại', output: 'Đầu ra sẵn sàng', download: 'Tải kết quả xuống', contract: 'Hợp đồng thực thi', localOnly: 'chỉ dùng bộ chuyển đổi cục bộ.', unsupported: 'Các bước không được hỗ trợ sẽ thất bại rõ ràng; không tệp nào được tải lên.', moveUp: 'Di chuyển {title} lên', moveDown: 'Di chuyển {title} xuống', remove: 'Xóa {title}' },
};

const getCopy = (locale: Locale): ChainCopy => COPY[locale] ?? COPY.en;
const interpolate = (value: string, title: string): string => value.replace('{title}', title);

export function ToolChainPanel({ currentToolId, locale = 'en' as Locale }: { currentToolId?: string | null; locale?: Locale }) {
  const copy = getCopy(locale);
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState(() => getToolChain());
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTool, setActiveTool] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const tools = useMemo(() => getReadyToolConfigs(), []);
  const selected = chain.map((step) => ({ step, tool: tools.find((tool) => tool.id === step.id) })).filter((item): item is { step: typeof chain[number]; tool: (typeof tools)[number] } => Boolean(item.tool));

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const refresh = () => setChain(getToolChain());
  const addCurrent = () => {
    if (!currentToolId) return;
    addToolToChain(currentToolId);
    refresh();
  };

  const runChain = async () => {
    if (!inputFile || selected.length === 0 || running) return;
    setRunning(true);
    setProgress(0);
    setActiveTool('');
    setError('');
    setResult(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
    try {
      const { runStoredToolChain } = await import('../lib/tool-chain-runner');
      const output = await runStoredToolChain(
        selected.map(({ step }) => step.id),
        { blob: inputFile, fileName: inputFile.name },
        (completed, total, toolId) => {
          setProgress(Math.round((completed / total) * 100));
          setActiveTool(toolId);
        },
      );
      setProgress(100);
      setActiveTool(selected[selected.length - 1]?.tool.title ?? '');
      setResult(output);
      setResultUrl(URL.createObjectURL(output.blob));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tool chain failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="flixo-chain-panel" aria-label={copy.aria}>
      <div className="flixo-chain-panel__bar">
        <div>
          <strong>{copy.title}</strong>
          <span>{selected.length}/8 {copy.steps}</span>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? copy.hide : copy.open}
        </button>
      </div>
      {open && (
        <div className="flixo-chain-panel__body">
          <div className="flixo-chain-panel__actions">
            <button type="button" onClick={addCurrent} disabled={!currentToolId || chain.some((step) => step.id === currentToolId) || selected.length >= 8}>{copy.add}</button>
            <button type="button" onClick={() => { clearToolChain(); refresh(); }} disabled={selected.length === 0}>{copy.clear}</button>
          </div>
          {selected.length === 0 ? (
            <p className="flixo-chain-panel__empty">{copy.empty}</p>
          ) : (
            <ol className="flixo-chain-panel__list">
              {selected.map(({ tool }, index) => (
                <li key={tool.id}>
                  <span className="flixo-chain-panel__index">{index + 1}</span>
                  <div className="flixo-chain-panel__tool"><strong>{tool.title}</strong><span>{tool.category}</span></div>
                  <div className="flixo-chain-panel__row-actions">
                    <button type="button" onClick={() => { moveToolInChain(tool.id, -1); refresh(); }} disabled={index === 0 || running} aria-label={interpolate(copy.moveUp, tool.title)}>↑</button>
                    <button type="button" onClick={() => { moveToolInChain(tool.id, 1); refresh(); }} disabled={index === selected.length - 1 || running} aria-label={interpolate(copy.moveDown, tool.title)}>↓</button>
                    <button type="button" onClick={() => { removeToolFromChain(tool.id); refresh(); }} disabled={running} aria-label={interpolate(copy.remove, tool.title)}>×</button>
                  </div>
                  {index < selected.length - 1 && <span className="flixo-chain-panel__connector" aria-hidden="true">↓</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="flixo-chain-panel__runner">
            <label className="flixo-chain-panel__file">
              <span>{copy.input}</span>
              <input type="file" accept="image/*" disabled={running} onChange={(event) => { setInputFile(event.target.files?.[0] ?? null); setError(''); setResult(null); }} />
            </label>
            <button type="button" className="flixo-chain-panel__run" onClick={() => void runChain()} disabled={!inputFile || selected.length === 0 || running}>
              {running ? `${copy.processing} ${progress}%` : copy.run}
            </button>
            {activeTool && <div className="flixo-chain-panel__progress" role="status">{copy.current}: {activeTool}</div>}
            {error && <div className="flixo-chain-panel__error" role="alert">{error}</div>}
            {result && resultUrl && (
              <div className="flixo-chain-panel__result">
                <span>{copy.output}: {result.fileName}</span>
                <a href={resultUrl} download={result.fileName}>{copy.download}</a>
              </div>
            )}
          </div>
          <div className="flixo-chain-panel__status" role="status">
            <strong>{copy.contract}:</strong> {copy.localOnly} {copy.unsupported}
          </div>
        </div>
      )}
    </aside>
  );
}
