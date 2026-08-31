import { useEffect, useRef, useState } from 'react';
import { buildFfmpegArguments, calculateSavings, getOutputMimeType, makeOutputFilename, normalizeVideoFormat, normalizeVideoQuality, type VideoOutputFormat, type VideoQuality } from './engine';
import { normalizeLocale, type Locale } from '../../lib/i18n/config';

type WorkerMessage =
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'status'; jobId: string; message: string }
  | { type: 'done'; jobId: string; bytes: Uint8Array }
  | { type: 'error'; jobId: string; message: string };

type VideoCopy = { title: string; description: string; choose: string; format: string; quality: string; high: string; balanced: string; small: string; compress: string; processing: string; download: string; input: string; selected: (size: string) => string; ready: (saving: string) => string; workerError: string; readError: string; invalid: string; };

const COPY: Record<Locale, VideoCopy> = {
  en: { title: 'Video Compressor & Converter', description: 'Compress or convert video locally with a background FFmpeg worker.', choose: 'Choose video', format: 'Output format', quality: 'Quality', high: 'High', balanced: 'Balanced', small: 'Small', compress: 'Compress / Convert', processing: 'Processing…', download: 'Download output', input: 'Input', selected: (s) => `${s} MB selected`, ready: (s) => `Ready · ${s}% size reduction`, workerError: 'Video processing worker failed.', readError: 'Unable to read the selected file.', invalid: 'Please choose a video file.' },
  ar: { title: 'ضاغط ومحوّل الفيديو', description: 'اضغط الفيديو أو حوّله محليًا باستخدام عامل FFmpeg في الخلفية.', choose: 'اختر فيديو', format: 'تنسيق الإخراج', quality: 'الجودة', high: 'عالية', balanced: 'متوازنة', small: 'صغيرة', compress: 'ضغط / تحويل', processing: 'جارٍ المعالجة…', download: 'تنزيل الناتج', input: 'الإدخال', selected: (s) => `تم اختيار ${s} ميجابايت`, ready: (s) => `جاهز · تقليل الحجم ${s}%`, workerError: 'فشل عامل معالجة الفيديو.', readError: 'تعذّر قراءة الملف المحدد.', invalid: 'يرجى اختيار ملف فيديو.' },
  es: { title: 'Compresor y conversor de vídeo', description: 'Comprime o convierte vídeo localmente con un trabajador FFmpeg en segundo plano.', choose: 'Elegir vídeo', format: 'Formato de salida', quality: 'Calidad', high: 'Alta', balanced: 'Equilibrada', small: 'Pequeña', compress: 'Comprimir / Convertir', processing: 'Procesando…', download: 'Descargar resultado', input: 'Entrada', selected: (s) => `${s} MB seleccionados`, ready: (s) => `Listo · reducción de tamaño ${s}%`, workerError: 'El proceso de vídeo falló.', readError: 'No se pudo leer el archivo seleccionado.', invalid: 'Elige un archivo de vídeo.' },
  fr: { title: 'Compresseur et convertisseur vidéo', description: 'Compressez ou convertissez une vidéo localement avec un worker FFmpeg en arrière-plan.', choose: 'Choisir une vidéo', format: 'Format de sortie', quality: 'Qualité', high: 'Élevée', balanced: 'Équilibrée', small: 'Petite', compress: 'Compresser / Convertir', processing: 'Traitement…', download: 'Télécharger le résultat', input: 'Entrée', selected: (s) => `${s} Mo sélectionnés`, ready: (s) => `Prêt · réduction de taille ${s}%`, workerError: 'Le traitement vidéo a échoué.', readError: 'Impossible de lire le fichier sélectionné.', invalid: 'Veuillez choisir un fichier vidéo.' },
  de: { title: 'Video-Kompressor und Konverter', description: 'Komprimieren oder konvertieren Sie Videos lokal mit einem FFmpeg-Worker im Hintergrund.', choose: 'Video auswählen', format: 'Ausgabeformat', quality: 'Qualität', high: 'Hoch', balanced: 'Ausgewogen', small: 'Klein', compress: 'Komprimieren / Konvertieren', processing: 'Verarbeitung…', download: 'Ausgabe herunterladen', input: 'Eingabe', selected: (s) => `${s} MB ausgewählt`, ready: (s) => `Fertig · Größenreduzierung ${s}%`, workerError: 'Die Videoverarbeitung ist fehlgeschlagen.', readError: 'Die ausgewählte Datei konnte nicht gelesen werden.', invalid: 'Bitte eine Videodatei auswählen.' },
  ru: { title: 'Компрессор и конвертер видео', description: 'Сжимайте или конвертируйте видео локально с помощью фонового обработчика FFmpeg.', choose: 'Выбрать видео', format: 'Формат вывода', quality: 'Качество', high: 'Высокое', balanced: 'Сбалансированное', small: 'Маленькое', compress: 'Сжать / Конвертировать', processing: 'Обработка…', download: 'Скачать результат', input: 'Вход', selected: (s) => `Выбрано ${s} МБ`, ready: (s) => `Готово · уменьшение размера ${s}%`, workerError: 'Обработчик видео завершился с ошибкой.', readError: 'Не удалось прочитать выбранный файл.', invalid: 'Выберите видеофайл.' },
  zh: { title: '视频压缩与转换器', description: '使用后台 FFmpeg 工作线程在本地压缩或转换视频。', choose: '选择视频', format: '输出格式', quality: '质量', high: '高', balanced: '均衡', small: '小', compress: '压缩 / 转换', processing: '处理中…', download: '下载结果', input: '输入', selected: (s) => `已选择 ${s} MB`, ready: (s) => `就绪 · 减小 ${s}%`, workerError: '视频处理工作线程失败。', readError: '无法读取所选文件。', invalid: '请选择视频文件。' },
  hi: { title: 'वीडियो कंप्रेसर और कन्वर्टर', description: 'बैकग्राउंड FFmpeg वर्कर से वीडियो को स्थानीय रूप से कंप्रेस या कन्वर्ट करें।', choose: 'वीडियो चुनें', format: 'आउटपुट फ़ॉर्मैट', quality: 'गुणवत्ता', high: 'उच्च', balanced: 'संतुलित', small: 'छोटा', compress: 'कंप्रेस / कन्वर्ट', processing: 'प्रोसेस हो रहा है…', download: 'आउटपुट डाउनलोड करें', input: 'इनपुट', selected: (s) => `${s} MB चुना गया`, ready: (s) => `तैयार · आकार में ${s}% कमी`, workerError: 'वीडियो प्रोसेसिंग वर्कर विफल हुआ।', readError: 'चयनित फ़ाइल पढ़ी नहीं जा सकी।', invalid: 'कृपया वीडियो फ़ाइल चुनें।' },
  id: { title: 'Kompresor & Konverter Video', description: 'Kompres atau konversi video secara lokal dengan pekerja FFmpeg di latar belakang.', choose: 'Pilih video', format: 'Format keluaran', quality: 'Kualitas', high: 'Tinggi', balanced: 'Seimbang', small: 'Kecil', compress: 'Kompres / Konversi', processing: 'Memproses…', download: 'Unduh hasil', input: 'Masukan', selected: (s) => `${s} MB dipilih`, ready: (s) => `Siap · pengurangan ukuran ${s}%`, workerError: 'Pekerja pemrosesan video gagal.', readError: 'Tidak dapat membaca file yang dipilih.', invalid: 'Pilih file video.' },
  ur: { title: 'ویڈیو کمپریسر اور کنورٹر', description: 'پس منظر کے FFmpeg ورکر کے ساتھ ویڈیو کو مقامی طور پر کمپریس یا تبدیل کریں۔', choose: 'ویڈیو منتخب کریں', format: 'آؤٹ پٹ فارمیٹ', quality: 'معیار', high: 'اعلیٰ', balanced: 'متوازن', small: 'چھوٹا', compress: 'کمپریس / تبدیل کریں', processing: 'پروسیسنگ جاری ہے…', download: 'آؤٹ پٹ ڈاؤن لوڈ کریں', input: 'ان پٹ', selected: (s) => `${s} MB منتخب`, ready: (s) => `تیار · سائز میں ${s}% کمی`, workerError: 'ویڈیو پروسیسنگ ورکر ناکام ہو گیا۔', readError: 'منتخب فائل پڑھی نہیں جا سکی۔', invalid: 'ویڈیو فائل منتخب کریں۔' },
  ja: { title: '動画圧縮・変換', description: 'バックグラウンドの FFmpeg ワーカーで動画をローカルに圧縮または変換します。', choose: '動画を選択', format: '出力形式', quality: '品質', high: '高', balanced: '標準', small: '小', compress: '圧縮 / 変換', processing: '処理中…', download: '出力をダウンロード', input: '入力', selected: (s) => `${s} MB を選択`, ready: (s) => `完了 · サイズを ${s}% 削減`, workerError: '動画処理ワーカーに失敗しました。', readError: '選択したファイルを読み込めません。', invalid: '動画ファイルを選択してください。' },
  pt: { title: 'Compressor e conversor de vídeo', description: 'Comprima ou converta vídeo localmente com um worker FFmpeg em segundo plano.', choose: 'Escolher vídeo', format: 'Formato de saída', quality: 'Qualidade', high: 'Alta', balanced: 'Equilibrada', small: 'Pequena', compress: 'Comprimir / Converter', processing: 'Processando…', download: 'Baixar resultado', input: 'Entrada', selected: (s) => `${s} MB selecionados`, ready: (s) => `Pronto · redução de tamanho ${s}%`, workerError: 'O worker de processamento de vídeo falhou.', readError: 'Não foi possível ler o arquivo selecionado.', invalid: 'Escolha um arquivo de vídeo.' },
  it: { title: 'Compressore e convertitore video', description: 'Comprimi o converti video localmente con un worker FFmpeg in background.', choose: 'Scegli video', format: 'Formato di output', quality: 'Qualità', high: 'Alta', balanced: 'Bilanciata', small: 'Piccola', compress: 'Comprimi / Converti', processing: 'Elaborazione…', download: 'Scarica risultato', input: 'Input', selected: (s) => `${s} MB selezionati`, ready: (s) => `Pronto · riduzione dimensione ${s}%`, workerError: 'Il worker di elaborazione video non è riuscito.', readError: 'Impossibile leggere il file selezionato.', invalid: 'Scegli un file video.' },
  ko: { title: '동영상 압축 및 변환기', description: '백그라운드 FFmpeg 워커로 동영상을 로컬에서 압축하거나 변환합니다.', choose: '동영상 선택', format: '출력 형식', quality: '품질', high: '높음', balanced: '균형', small: '작게', compress: '압축 / 변환', processing: '처리 중…', download: '결과 다운로드', input: '입력', selected: (s) => `${s} MB 선택됨`, ready: (s) => `완료 · 크기 ${s}% 감소`, workerError: '동영상 처리 워커가 실패했습니다.', readError: '선택한 파일을 읽을 수 없습니다.', invalid: '동영상 파일을 선택하세요.' },
  nl: { title: 'Videocompressor en converter', description: 'Comprimeer of converteer video lokaal met een FFmpeg-worker op de achtergrond.', choose: 'Video kiezen', format: 'Uitvoerformaat', quality: 'Kwaliteit', high: 'Hoog', balanced: 'Gebalanceerd', small: 'Klein', compress: 'Comprimeren / Converteren', processing: 'Verwerken…', download: 'Resultaat downloaden', input: 'Invoer', selected: (s) => `${s} MB geselecteerd`, ready: (s) => `Klaar · grootte ${s}% kleiner`, workerError: 'De videobewerkingsworker is mislukt.', readError: 'Kan het geselecteerde bestand niet lezen.', invalid: 'Kies een videobestand.' },
  pl: { title: 'Kompresor i konwerter wideo', description: 'Kompresuj lub konwertuj wideo lokalnie za pomocą procesu FFmpeg w tle.', choose: 'Wybierz wideo', format: 'Format wyjściowy', quality: 'Jakość', high: 'Wysoka', balanced: 'Zrównoważona', small: 'Mała', compress: 'Kompresuj / Konwertuj', processing: 'Przetwarzanie…', download: 'Pobierz wynik', input: 'Wejście', selected: (s) => `Wybrano ${s} MB`, ready: (s) => `Gotowe · zmniejszenie rozmiaru ${s}%`, workerError: 'Proces przetwarzania wideo nie powiódł się.', readError: 'Nie można odczytać wybranego pliku.', invalid: 'Wybierz plik wideo.' },
  tr: { title: 'Video Sıkıştırıcı ve Dönüştürücü', description: 'Arka plandaki FFmpeg çalışanıyla videoyu yerel olarak sıkıştırın veya dönüştürün.', choose: 'Video seç', format: 'Çıkış biçimi', quality: 'Kalite', high: 'Yüksek', balanced: 'Dengeli', small: 'Küçük', compress: 'Sıkıştır / Dönüştür', processing: 'İşleniyor…', download: 'Çıktıyı indir', input: 'Girdi', selected: (s) => `${s} MB seçildi`, ready: (s) => `Hazır · boyut ${s}% küçüldü`, workerError: 'Video işleme çalışanı başarısız oldu.', readError: 'Seçilen dosya okunamadı.', invalid: 'Bir video dosyası seçin.' },
  vi: { title: 'Trình nén và chuyển đổi video', description: 'Nén hoặc chuyển đổi video cục bộ bằng worker FFmpeg chạy nền.', choose: 'Chọn video', format: 'Định dạng đầu ra', quality: 'Chất lượng', high: 'Cao', balanced: 'Cân bằng', small: 'Nhỏ', compress: 'Nén / Chuyển đổi', processing: 'Đang xử lý…', download: 'Tải kết quả', input: 'Đầu vào', selected: (s) => `Đã chọn ${s} MB`, ready: (s) => `Sẵn sàng · giảm kích thước ${s}%`, workerError: 'Worker xử lý video đã thất bại.', readError: 'Không thể đọc tệp đã chọn.', invalid: 'Hãy chọn tệp video.' },
  th: { title: 'เครื่องมือบีบอัดและแปลงวิดีโอ', description: 'บีบอัดหรือแปลงวิดีโอในเครื่องด้วย FFmpeg worker ที่ทำงานเบื้องหลัง', choose: 'เลือกวิดีโอ', format: 'รูปแบบเอาต์พุต', quality: 'คุณภาพ', high: 'สูง', balanced: 'สมดุล', small: 'เล็ก', compress: 'บีบอัด / แปลง', processing: 'กำลังประมวลผล…', download: 'ดาวน์โหลดผลลัพธ์', input: 'อินพุต', selected: (s) => `เลือก ${s} MB`, ready: (s) => `พร้อม · ลดขนาด ${s}%`, workerError: 'ตัวประมวลผลวิดีโอล้มเหลว', readError: 'ไม่สามารถอ่านไฟล์ที่เลือกได้', invalid: 'โปรดเลือกไฟล์วิดีโอ' },
  sv: { title: 'Videokompressor och konverterare', description: 'Komprimera eller konvertera video lokalt med en FFmpeg-worker i bakgrunden.', choose: 'Välj video', format: 'Utdataformat', quality: 'Kvalitet', high: 'Hög', balanced: 'Balanserad', small: 'Liten', compress: 'Komprimera / Konvertera', processing: 'Bearbetar…', download: 'Ladda ner resultat', input: 'Indata', selected: (s) => `${s} MB valt`, ready: (s) => `Klar · storleken minskad ${s}%`, workerError: 'Videobearbetningen misslyckades.', readError: 'Det gick inte att läsa den valda filen.', invalid: 'Välj en videofil.' },
};

export function VideoCompressorConverterTool({ locale: propLocale }: { locale?: Locale }) {
  const locale = propLocale ?? normalizeLocale(typeof document === 'undefined' ? 'en' : document.documentElement.lang);
  const copy = COPY[locale];
  const workerRef = useRef<Worker | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<VideoOutputFormat>('mp4');
  const [quality, setQuality] = useState<VideoQuality>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const choose = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('video/')) { setError(copy.invalid); return; }
    setFile(next); setError(''); setOutputSize(null);
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = null; setOutputUrl(null);
    setStatus(copy.selected((next.size / 1024 / 1024).toFixed(2)));
  };

  const run = () => {
    if (!file || busy) return;
    setBusy(true); setProgress(0); setError(''); setOutputSize(null); setStatus(copy.processing);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const jobId = crypto.randomUUID();
    const inputName = `input-${jobId}.${file.name.split('.').pop() || 'mp4'}`;
    const outputName = `output-${jobId}.${format}`;
    const args = buildFfmpegArguments(inputName, outputName, normalizeVideoFormat(format), normalizeVideoQuality(quality));
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (data.jobId !== jobId) return;
      if (data.type === 'progress') { setProgress(Math.round(data.progress * 100)); setStatus(`${copy.processing} ${Math.round(data.progress * 100)}%`); return; }
      if (data.type === 'status') { setStatus(data.message); return; }
      if (data.type === 'error') { setBusy(false); setError(data.message); setStatus(''); worker.terminate(); return; }
      const outputBuffer = new ArrayBuffer(data.bytes.byteLength);
      new Uint8Array(outputBuffer).set(data.bytes);
      const blob = new Blob([outputBuffer], { type: getOutputMimeType(format) });
      const url = URL.createObjectURL(blob);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = url; setOutputUrl(url); setOutputSize(blob.size); setProgress(100); setBusy(false);
      setStatus(copy.ready(calculateSavings(file.size, blob.size).toFixed(1))); worker.terminate();
    };
    worker.onerror = () => { setBusy(false); setError(copy.workerError); setStatus(''); worker.terminate(); };
    void file.arrayBuffer().then((buffer) => {
      const transferable = new Uint8Array(buffer);
      worker.postMessage({ jobId, file: transferable, inputName, outputName, args }, [buffer]);
    }).catch(() => { setBusy(false); setError(copy.readError); worker.terminate(); });
  };

  return <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
    <div><h1 className="text-2xl font-bold">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div>
    <label className="rounded-xl border border-dashed border-border p-6 text-center"><span className="mb-3 block font-medium">{copy.choose}</span><input aria-label={copy.choose} type="file" accept="video/*" onChange={(event) => choose(event.target.files?.[0])} /></label>
    <div className="grid gap-4 md:grid-cols-2">
      <label>{copy.format}<select aria-label={copy.format} className="mt-1 w-full rounded border p-2" value={format} onChange={(e) => setFormat(normalizeVideoFormat(e.target.value))}><option value="mp4">MP4</option><option value="webm">WebM</option><option value="gif">GIF</option></select></label>
      <label>{copy.quality}<select aria-label={copy.quality} className="mt-1 w-full rounded border p-2" value={quality} onChange={(e) => setQuality(normalizeVideoQuality(e.target.value))}><option value="high">{copy.high}</option><option value="balanced">{copy.balanced}</option><option value="small">{copy.small}</option></select></label>
    </div>
    {file ? <p className="text-sm text-muted-foreground">{copy.input}: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}
    <button type="button" disabled={!file || busy} onClick={run} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? copy.processing : copy.compress}</button>
    {busy ? <progress aria-label={copy.processing} className="w-full" max={100} value={progress} /> : null}
    {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {outputUrl ? <a className="rounded-xl border border-border px-4 py-3 text-center font-semibold" href={outputUrl} download={file ? makeOutputFilename(file.name, format) : `flixo-video.${format}`}>{copy.download}{outputSize ? ` · ${(outputSize / 1024 / 1024).toFixed(2)} MB` : ''}</a> : null}
  </section>;
}
