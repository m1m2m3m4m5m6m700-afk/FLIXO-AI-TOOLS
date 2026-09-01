import { useEffect, useRef, useState } from 'react';
import { calculateSavings, getOutputName, normalizeQuality, type CompressionQuality } from './engine';
import type { Locale } from '../../lib/i18n';

type WorkerMessage =
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'done'; jobId: string; bytes: ArrayBuffer }
  | { type: 'error'; jobId: string; message: string };

type Copy = Readonly<{
  title: string; description: string; choose: string; audioFile: string; quality: string; high: string; balanced: string; small: string;
  input: string; compressing: string; compress: string; progress: string; workerError: string; decodeError: string; chooseError: string;
  sizeChange: string; download: string;
}>;

const COPY: Record<string, Copy> = {
  ar: { title: 'ضاغط الصوت', description: 'قلّل حجم الصوت المفكوك محليًا باستخدام عامل في الخلفية.', choose: 'اختر ملفًا صوتيًا', audioFile: 'ملف صوتي', quality: 'الجودة', high: 'عالية', balanced: 'متوازنة', small: 'صغيرة', input: 'الإدخال', compressing: 'جارٍ الضغط…', compress: 'ضغط الصوت', progress: 'تقدم الضغط', workerError: 'فشل عامل معالجة الصوت.', decodeError: 'تعذّر فك ترميز الملف الصوتي المحدد.', chooseError: 'يرجى اختيار ملف صوتي.', sizeChange: 'تغير الحجم', download: 'تنزيل WAV المضغوط' },
  en: { title: 'Audio Compressor', description: 'Reduce decoded audio size locally with a background worker.', choose: 'Choose audio', audioFile: 'Audio file', quality: 'Quality', high: 'High', balanced: 'Balanced', small: 'Small', input: 'Input', compressing: 'Compressing…', compress: 'Compress Audio', progress: 'Compression progress', workerError: 'Audio processing worker failed.', decodeError: 'Unable to decode the selected audio file.', chooseError: 'Please choose an audio file.', sizeChange: 'Size change', download: 'Download compressed WAV' },
  es: { title: 'Compresor de audio', description: 'Reduce el tamaño del audio decodificado localmente con un trabajador en segundo plano.', choose: 'Elegir audio', audioFile: 'Archivo de audio', quality: 'Calidad', high: 'Alta', balanced: 'Equilibrada', small: 'Pequeña', input: 'Entrada', compressing: 'Comprimiendo…', compress: 'Comprimir audio', progress: 'Progreso de compresión', workerError: 'El trabajador de procesamiento de audio falló.', decodeError: 'No se pudo decodificar el archivo de audio seleccionado.', chooseError: 'Elige un archivo de audio.', sizeChange: 'Cambio de tamaño', download: 'Descargar WAV comprimido' },
  fr: { title: 'Compresseur audio', description: 'Réduisez localement la taille de l’audio décodé avec un worker en arrière-plan.', choose: 'Choisir un fichier audio', audioFile: 'Fichier audio', quality: 'Qualité', high: 'Élevée', balanced: 'Équilibrée', small: 'Petite', input: 'Entrée', compressing: 'Compression…', compress: 'Compresser l’audio', progress: 'Progression de la compression', workerError: 'Le worker de traitement audio a échoué.', decodeError: 'Impossible de décoder le fichier audio sélectionné.', chooseError: 'Veuillez choisir un fichier audio.', sizeChange: 'Évolution de la taille', download: 'Télécharger le WAV compressé' },
  de: { title: 'Audio-Kompressor', description: 'Reduzieren Sie die Größe dekodierter Audiodaten lokal mit einem Hintergrund-Worker.', choose: 'Audiodatei auswählen', audioFile: 'Audiodatei', quality: 'Qualität', high: 'Hoch', balanced: 'Ausgewogen', small: 'Klein', input: 'Eingabe', compressing: 'Wird komprimiert…', compress: 'Audio komprimieren', progress: 'Komprimierungsfortschritt', workerError: 'Der Audio-Verarbeitungs-Worker ist fehlgeschlagen.', decodeError: 'Die ausgewählte Audiodatei konnte nicht dekodiert werden.', chooseError: 'Bitte wählen Sie eine Audiodatei.', sizeChange: 'Größenänderung', download: 'Komprimiertes WAV herunterladen' },
  hi: { title: 'ऑडियो कंप्रेसर', description: 'बैकग्राउंड वर्कर के साथ डिकोड किए गए ऑडियो का आकार स्थानीय रूप से कम करें।', choose: 'ऑडियो चुनें', audioFile: 'ऑडियो फ़ाइल', quality: 'गुणवत्ता', high: 'उच्च', balanced: 'संतुलित', small: 'छोटी', input: 'इनपुट', compressing: 'कंप्रेस हो रहा है…', compress: 'ऑडियो कंप्रेस करें', progress: 'कंप्रेशन प्रगति', workerError: 'ऑडियो प्रोसेसिंग वर्कर विफल हुआ।', decodeError: 'चयनित ऑडियो फ़ाइल को डिकोड नहीं किया जा सका।', chooseError: 'कृपया ऑडियो फ़ाइल चुनें।', sizeChange: 'आकार में बदलाव', download: 'कंप्रेस किया हुआ WAV डाउनलोड करें' },
  id: { title: 'Kompresor Audio', description: 'Kurangi ukuran audio yang telah didekode secara lokal dengan worker latar belakang.', choose: 'Pilih audio', audioFile: 'File audio', quality: 'Kualitas', high: 'Tinggi', balanced: 'Seimbang', small: 'Kecil', input: 'Input', compressing: 'Mengompres…', compress: 'Kompres Audio', progress: 'Kemajuan kompresi', workerError: 'Worker pemrosesan audio gagal.', decodeError: 'File audio yang dipilih tidak dapat didekode.', chooseError: 'Silakan pilih file audio.', sizeChange: 'Perubahan ukuran', download: 'Unduh WAV terkompresi' },
  it: { title: 'Compressore audio', description: 'Riduci localmente le dimensioni dell’audio decodificato con un worker in background.', choose: 'Scegli audio', audioFile: 'File audio', quality: 'Qualità', high: 'Alta', balanced: 'Bilanciata', small: 'Piccola', input: 'Input', compressing: 'Compressione…', compress: 'Comprimi audio', progress: 'Avanzamento compressione', workerError: 'Il worker di elaborazione audio non è riuscito.', decodeError: 'Impossibile decodificare il file audio selezionato.', chooseError: 'Scegli un file audio.', sizeChange: 'Variazione dimensioni', download: 'Scarica WAV compresso' },
  ja: { title: 'オーディオ圧縮', description: 'バックグラウンドワーカーでデコード済み音声をブラウザ内で圧縮します。', choose: '音声を選択', audioFile: '音声ファイル', quality: '品質', high: '高', balanced: 'バランス', small: '小', input: '入力', compressing: '圧縮中…', compress: '音声を圧縮', progress: '圧縮の進行状況', workerError: '音声処理ワーカーに失敗しました。', decodeError: '選択した音声ファイルをデコードできませんでした。', chooseError: '音声ファイルを選択してください。', sizeChange: 'サイズの変化', download: '圧縮 WAV をダウンロード' },
  ko: { title: '오디오 압축기', description: '백그라운드 워커를 사용해 디코딩된 오디오 크기를 브라우저에서 줄입니다.', choose: '오디오 선택', audioFile: '오디오 파일', quality: '품질', high: '높음', balanced: '균형', small: '작음', input: '입력', compressing: '압축 중…', compress: '오디오 압축', progress: '압축 진행률', workerError: '오디오 처리 워커가 실패했습니다.', decodeError: '선택한 오디오 파일을 디코딩할 수 없습니다.', chooseError: '오디오 파일을 선택하세요.', sizeChange: '크기 변화', download: '압축된 WAV 다운로드' },
  ms: { title: 'Pemampat Audio', description: 'Kurangkan saiz audio dinyahkod secara setempat dengan pekerja latar belakang.', choose: 'Pilih audio', audioFile: 'Fail audio', quality: 'Kualiti', high: 'Tinggi', balanced: 'Seimbang', small: 'Kecil', input: 'Input', compressing: 'Memampatkan…', compress: 'Mampatkan Audio', progress: 'Kemajuan pemampatan', workerError: 'Pekerja pemprosesan audio gagal.', decodeError: 'Fail audio yang dipilih tidak dapat dinyahkod.', chooseError: 'Sila pilih fail audio.', sizeChange: 'Perubahan saiz', download: 'Muat turun WAV termampat' },
  nl: { title: 'Audiocompressor', description: 'Verklein lokaal de grootte van gedecodeerde audio met een achtergrondworker.', choose: 'Audio kiezen', audioFile: 'Audiobestand', quality: 'Kwaliteit', high: 'Hoog', balanced: 'Gebalanceerd', small: 'Klein', input: 'Invoer', compressing: 'Comprimeren…', compress: 'Audio comprimeren', progress: 'Voortgang van compressie', workerError: 'De audiobewerkingsworker is mislukt.', decodeError: 'Het geselecteerde audiobestand kon niet worden gedecodeerd.', chooseError: 'Kies een audiobestand.', sizeChange: 'Groottewijziging', download: 'Gecomprimeerde WAV downloaden' },
  pl: { title: 'Kompresor audio', description: 'Zmniejsz lokalnie rozmiar zdekodowanego dźwięku za pomocą workera w tle.', choose: 'Wybierz audio', audioFile: 'Plik audio', quality: 'Jakość', high: 'Wysoka', balanced: 'Zrównoważona', small: 'Mała', input: 'Wejście', compressing: 'Kompresowanie…', compress: 'Kompresuj audio', progress: 'Postęp kompresji', workerError: 'Worker przetwarzania audio zakończył się niepowodzeniem.', decodeError: 'Nie można zdekodować wybranego pliku audio.', chooseError: 'Wybierz plik audio.', sizeChange: 'Zmiana rozmiaru', download: 'Pobierz skompresowany WAV' },
  pt: { title: 'Compressor de áudio', description: 'Reduza localmente o tamanho do áudio descodificado com um worker em segundo plano.', choose: 'Escolher áudio', audioFile: 'Ficheiro de áudio', quality: 'Qualidade', high: 'Alta', balanced: 'Equilibrada', small: 'Pequena', input: 'Entrada', compressing: 'A comprimir…', compress: 'Comprimir áudio', progress: 'Progresso da compressão', workerError: 'O worker de processamento de áudio falhou.', decodeError: 'Não foi possível descodificar o ficheiro de áudio selecionado.', chooseError: 'Escolha um ficheiro de áudio.', sizeChange: 'Alteração de tamanho', download: 'Transferir WAV comprimido' },
  ru: { title: 'Аудиокомпрессор', description: 'Уменьшайте размер декодированного аудио локально с помощью фонового воркера.', choose: 'Выбрать аудио', audioFile: 'Аудиофайл', quality: 'Качество', high: 'Высокое', balanced: 'Сбалансированное', small: 'Малое', input: 'Вход', compressing: 'Сжатие…', compress: 'Сжать аудио', progress: 'Прогресс сжатия', workerError: 'Ошибка фонового обработчика аудио.', decodeError: 'Не удалось декодировать выбранный аудиофайл.', chooseError: 'Выберите аудиофайл.', sizeChange: 'Изменение размера', download: 'Скачать сжатый WAV' },
  sv: { title: 'Ljudkompressor', description: 'Minska storleken på avkodat ljud lokalt med en bakgrundsworker.', choose: 'Välj ljud', audioFile: 'Ljudfil', quality: 'Kvalitet', high: 'Hög', balanced: 'Balanserad', small: 'Liten', input: 'Indata', compressing: 'Komprimerar…', compress: 'Komprimera ljud', progress: 'Komprimeringsförlopp', workerError: 'Ljudbearbetningsworkern misslyckades.', decodeError: 'Det gick inte att avkoda den valda ljudfilen.', chooseError: 'Välj en ljudfil.', sizeChange: 'Storleksändring', download: 'Ladda ner komprimerad WAV' },
  th: { title: 'ตัวบีบอัดเสียง', description: 'ลดขนาดเสียงที่ถอดรหัสแล้วในเครื่องด้วย worker เบื้องหลัง', choose: 'เลือกไฟล์เสียง', audioFile: 'ไฟล์เสียง', quality: 'คุณภาพ', high: 'สูง', balanced: 'สมดุล', small: 'เล็ก', input: 'อินพุต', compressing: 'กำลังบีบอัด…', compress: 'บีบอัดเสียง', progress: 'ความคืบหน้าการบีบอัด', workerError: 'worker ประมวลผลเสียงทำงานล้มเหลว', decodeError: 'ไม่สามารถถอดรหัสไฟล์เสียงที่เลือกได้', chooseError: 'โปรดเลือกไฟล์เสียง', sizeChange: 'การเปลี่ยนแปลงขนาด', download: 'ดาวน์โหลด WAV ที่บีบอัด' },
  tr: { title: 'Ses Sıkıştırıcı', description: 'Kodlanmış sesin boyutunu arka plan çalışanıyla yerel olarak azaltın.', choose: 'Ses seç', audioFile: 'Ses dosyası', quality: 'Kalite', high: 'Yüksek', balanced: 'Dengeli', small: 'Küçük', input: 'Girdi', compressing: 'Sıkıştırılıyor…', compress: 'Sesi sıkıştır', progress: 'Sıkıştırma ilerlemesi', workerError: 'Ses işleme worker’ı başarısız oldu.', decodeError: 'Seçilen ses dosyası çözülemedi.', chooseError: 'Lütfen bir ses dosyası seçin.', sizeChange: 'Boyut değişimi', download: 'Sıkıştırılmış WAV indir' },
  uk: { title: 'Аудіокомпресор', description: 'Локально зменшуйте розмір декодованого аудіо за допомогою фонового воркера.', choose: 'Вибрати аудіо', audioFile: 'Аудіофайл', quality: 'Якість', high: 'Висока', balanced: 'Збалансована', small: 'Мала', input: 'Вхід', compressing: 'Стискання…', compress: 'Стиснути аудіо', progress: 'Прогрес стискання', workerError: 'Помилка фонового обробника аудіо.', decodeError: 'Не вдалося декодувати вибраний аудіофайл.', chooseError: 'Виберіть аудіофайл.', sizeChange: 'Зміна розміру', download: 'Завантажити стиснений WAV' },
  vi: { title: 'Trình nén âm thanh', description: 'Giảm kích thước âm thanh đã giải mã ngay trong trình duyệt bằng worker nền.', choose: 'Chọn âm thanh', audioFile: 'Tệp âm thanh', quality: 'Chất lượng', high: 'Cao', balanced: 'Cân bằng', small: 'Nhỏ', input: 'Đầu vào', compressing: 'Đang nén…', compress: 'Nén âm thanh', progress: 'Tiến trình nén', workerError: 'Worker xử lý âm thanh đã thất bại.', decodeError: 'Không thể giải mã tệp âm thanh đã chọn.', chooseError: 'Vui lòng chọn tệp âm thanh.', sizeChange: 'Thay đổi kích thước', download: 'Tải WAV đã nén' },
};

export function AudioCompressorTool({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = COPY[locale] ?? COPY.en;
  const workerRef = useRef<Worker | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<CompressionQuality>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const chooseFile = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('audio/')) { setError(copy.chooseError); return; }
    setFile(next); setError(''); setOutputSize(null);
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = null; setOutputUrl(null);
  };

  const compress = async () => {
    if (!file || busy) return;
    setBusy(true); setError(''); setProgress(0);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const jobId = crypto.randomUUID();
    try {
      const audioContext = new AudioContext();
      const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
      const samples = decoded.getChannelData(0).slice();
      const buffer = samples.buffer;
      worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (data.jobId !== jobId) return;
        if (data.type === 'progress') { setProgress(Math.round(data.progress * 100)); return; }
        if (data.type === 'error') { setError(data.message); setBusy(false); worker.terminate(); return; }
        const url = URL.createObjectURL(new Blob([data.bytes], { type: 'audio/wav' }));
        if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
        outputUrlRef.current = url; setOutputUrl(url); setOutputSize(data.bytes.byteLength); setProgress(100); setBusy(false); worker.terminate();
      };
      worker.onerror = () => { setError(copy.workerError); setBusy(false); worker.terminate(); };
      worker.postMessage({ jobId, samples, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels, quality: normalizeQuality(quality) }, [buffer]);
      await audioContext.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.decodeError); setBusy(false); worker.terminate();
    }
  };

  return <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
    <div><h1 className="text-2xl font-bold">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div>
    <label className="rounded-xl border border-dashed border-border p-6 text-center"><span className="mb-3 block font-medium">{copy.choose}</span><input aria-label={copy.audioFile} type="file" accept="audio/*" onChange={(e) => chooseFile(e.target.files?.[0])} /></label>
    <label>{copy.quality}<select aria-label={copy.quality} className="mt-1 w-full rounded border p-2" value={quality} onChange={(e) => setQuality(normalizeQuality(e.target.value))}><option value="high">{copy.high}</option><option value="balanced">{copy.balanced}</option><option value="small">{copy.small}</option></select></label>
    {file ? <p className="text-sm text-muted-foreground">{copy.input}: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}
    <button type="button" disabled={!file || busy} onClick={() => void compress()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? `${copy.compressing} ${progress}%` : copy.compress}</button>
    {busy ? <progress aria-label={copy.progress} className="w-full" max={100} value={progress} /> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {outputUrl ? <p className="text-sm text-muted-foreground">{copy.sizeChange}: {calculateSavings(file?.size ?? 0, outputSize ?? 0).toFixed(1)}%</p> : null}
    {outputUrl ? <a className="rounded-xl border border-border px-4 py-3 text-center font-semibold" href={outputUrl} download={file ? getOutputName(file.name) : 'flixo-compressed.wav'}>{copy.download} · {((outputSize ?? 0) / 1024 / 1024).toFixed(2)} MB</a> : null}
  </section>;
}
