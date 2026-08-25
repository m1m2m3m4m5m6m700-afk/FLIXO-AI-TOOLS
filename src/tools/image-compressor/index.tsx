import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage, MAX_FILES, MAX_INPUT_SIZE, type CompressionFormat } from './engine';

const formatLabels: Record<CompressionFormat, string> = {
  'image/webp': 'WebP',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

const MIN_PROCESSING_MS = 2000;

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function extensionFor(format: CompressionFormat) {
  return format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';
}

function label(locale: 'en' | 'ar', en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function ImageCompressor({ locale = 'en' }: { locale?: 'en' | 'ar' }) {
  const isArabic = locale === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(0.82);
  const [format, setFormat] = useState<CompressionFormat>('image/webp');
  const [maxWidth, setMaxWidth] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [targetSizeKB, setTargetSizeKB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; width: number; height: number; qualityUsed: number } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [outputPreviewUrl, setOutputPreviewUrl] = useState('');
  const [batchZipUrl, setBatchZipUrl] = useState('');
  const [batchCount, setBatchCount] = useState(0);

  const file = files[0] ?? null;
  const sourcePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  const savings = useMemo(() => {
    if (!file || !result) return 0;
    return Math.max(0, Math.round((1 - result.blob.size / file.size) * 100));
  }, [file, result]);

  useEffect(() => () => {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
  }, [sourcePreviewUrl]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      if (outputPreviewUrl) URL.revokeObjectURL(outputPreviewUrl);
      if (batchZipUrl) URL.revokeObjectURL(batchZipUrl);
    };
  }, [downloadUrl, outputPreviewUrl, batchZipUrl]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [locale]);

  const selectFiles = (nextFiles: File[]) => {
    setError('');
    setResult(null);
    setBatchZipUrl('');
    const empty = nextFiles.find((nextFile) => nextFile.size === 0);
    if (empty) {
      setFiles([]);
      setError(label(locale, 'The selected image file is empty.', 'ملف الصورة المحدد فارغ.'));
      return;
    }
    const selected = nextFiles.slice(0, MAX_FILES).filter((nextFile) => nextFile.size <= MAX_INPUT_SIZE);
    const rejectedCount = nextFiles.length - selected.length;
    if (rejectedCount > 0) {
      setError(label(locale, `Some files were skipped. Maximum ${MAX_FILES} files and ${formatBytes(MAX_INPUT_SIZE)} per file.`, `تم تجاهل بعض الملفات. الحد الأقصى ${MAX_FILES} ملفًا و${formatBytes(MAX_INPUT_SIZE)} لكل ملف.`));
    }
    setFiles(selected);
  };

  const processOne = async (nextFile: File) => compressImage(nextFile, {
    quality,
    format,
    maxWidth: maxWidth ? Number(maxWidth) : undefined,
    maxHeight: maxHeight ? Number(maxHeight) : undefined,
    targetSizeKB: targetSizeKB ? Number(targetSizeKB) : undefined,
  });

  const processCurrent = async () => {
    if (!file || busy) return;
    const startedAt = performance.now();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const compressed = await processOne(file);
      const remaining = MIN_PROCESSING_MS - (performance.now() - startedAt);
      if (remaining > 0) await delay(remaining);
      const nextDownload = URL.createObjectURL(compressed.blob);
      setDownloadUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextDownload;
      });
      setOutputPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(compressed.blob);
      });
      setResult(compressed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : label(locale, 'Compression failed', 'فشل ضغط الصورة'));
    } finally {
      setBusy(false);
    }
  };

  const processBatch = async () => {
    if (files.length < 2) return processCurrent();
    setBusy(true);
    setError('');
    setBatchZipUrl('');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const nextFile of files) {
        const compressed = await processOne(nextFile);
        const baseName = nextFile.name.replace(/\.[^.]+$/, '') || 'image';
        zip.file(`${baseName}-flixo.${extensionFor(format)}`, compressed.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      setBatchZipUrl(URL.createObjectURL(zipBlob));
      setBatchCount(files.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : label(locale, 'Batch compression failed', 'فشل ضغط الملفات دفعة واحدة'));
    } finally {
      setBusy(false);
    }
  };

  const title = label(locale, 'Compress Images Online', 'ضغط الصور أونلاين');
  const description = label(locale, 'Compress JPG, PNG, and WebP images locally in your browser with smart quality, target size, resizing, preview, and batch ZIP export.', 'قلّل حجم صور JPG وPNG وWebP داخل المتصفح مع جودة ذكية، وحجم مستهدف، وتغيير المقاس، ومعاينة، وضغط جماعي في ملف ZIP.');

  return (
    <main dir={isArabic ? 'rtl' : 'ltr'} className="image-tool-shell">
      <div className="image-tool-container">
        <header className="image-tool-header"><div><p className="image-tool-eyebrow">FLIXO · IMAGE TOOLS</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><p className="image-tool-lead">{description}</p></div><a className="language-link" href={isArabic ? '/en/image-compressor' : '/ar/image-compressor'}>{label(locale, 'العربية', 'English')}</a></header>
        <section className="compressor-grid" aria-label={label(locale, 'Image compression tool', 'أداة ضغط الصور')} aria-busy={busy}>
          <div className="compressor-card">
            <label className="upload-zone" htmlFor="image-file"><span className="upload-title">{files.length ? `${files.length} ${label(locale, files.length === 1 ? 'image selected' : 'images selected', files.length === 1 ? 'صورة محددة' : 'صور محددة')}` : label(locale, 'Choose images to start', 'اختر الصور للبدء')}</span><span className="upload-subtitle">JPG · PNG · WebP · GIF · BMP · SVG · {label(locale, `up to ${MAX_FILES} files`, `حتى ${MAX_FILES} ملفًا`)}</span></label>
            <input ref={inputRef} id="image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml" className="sr-only" multiple onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
            <div className="control-grid">
              <label><span>{label(locale, 'Output format', 'الصيغة')}</span><select value={format} onChange={(event) => setFormat(event.target.value as CompressionFormat)}>{Object.entries(formatLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
              <label><span>{label(locale, 'Quality', 'الجودة')} ({Math.round(quality * 100)}%)</span><input aria-label={label(locale, 'Quality', 'الجودة')} type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>
              <label><span>{label(locale, 'Target size (KB)', 'الحجم المستهدف (KB)')}</span><input inputMode="numeric" placeholder={label(locale, 'Optional', 'اختياري')} value={targetSizeKB} onChange={(event) => setTargetSizeKB(event.target.value.replace(/\D/g, ''))} /></label>
              <label><span>{label(locale, 'Max width', 'أقصى عرض')}</span><input inputMode="numeric" placeholder="Auto" value={maxWidth} onChange={(event) => setMaxWidth(event.target.value.replace(/\D/g, ''))} /></label>
              <label><span>{label(locale, 'Max height', 'أقصى ارتفاع')}</span><input inputMode="numeric" placeholder="Auto" value={maxHeight} onChange={(event) => setMaxHeight(event.target.value.replace(/\D/g, ''))} /></label>
            </div>
            <div className="button-row"><button className="primary-button" type="button" disabled={!file || busy} aria-disabled={busy ? 'true' : 'false'} onClick={() => void processCurrent()}>{busy ? label(locale, 'Processing…', 'جارٍ المعالجة…') : label(locale, 'Compress image', 'ضغط الصورة')}</button><button className="secondary-button" type="button" disabled={files.length < 2 || busy} onClick={() => void processBatch()}>{label(locale, 'Compress all to ZIP', 'ضغط الكل إلى ZIP')}</button></div>
            {error && <p role="alert" className="error-box">{error}</p>}
            <p className="privacy-note">🔒 {label(locale, 'Browser-first: your images are processed locally and are not sent to a Flixo server.', 'المعالجة محلية داخل المتصفح؛ الصور لا تُرسل إلى خادم Flixo لمعالجتها.')}</p>
          </div>
          <aside className="result-card" aria-live="polite"><p className="image-tool-eyebrow">{label(locale, 'RESULT', 'النتيجة')}</p>{result && file ? <><div className="result-number">{savings}%</div><p className="result-caption">{label(locale, 'smaller file size', 'تقليل في الحجم')}</p><dl className="stats-list"><div><dt>{label(locale, 'Before', 'قبل')}</dt><dd>{formatBytes(file.size)}</dd></div><div><dt>{label(locale, 'After', 'بعد')}</dt><dd>{formatBytes(result.blob.size)}</dd></div><div><dt>{label(locale, 'Dimensions', 'الأبعاد')}</dt><dd>{result.width} × {result.height}</dd></div><div><dt>{label(locale, 'Format', 'الصيغة')}</dt><dd>{formatLabels[format]}</dd></div><div><dt>{label(locale, 'Quality used', 'الجودة المستخدمة')}</dt><dd>{Math.round(result.qualityUsed * 100)}%</dd></div></dl><a className="download-button" href={downloadUrl} download={`flixo-compressed.${extensionFor(format)}`}>{label(locale, 'Download image', 'تنزيل الصورة')}</a></> : batchZipUrl ? <><div className="result-number">{batchCount}</div><p className="result-caption">{label(locale, 'images optimized', 'صور تم تحسينها')}</p><a className="download-button" href={batchZipUrl} download="flixo-compressed-images.zip">{label(locale, 'Download ZIP', 'تنزيل ZIP')}</a></> : <div className="empty-result">{label(locale, 'Verified output statistics and previews appear here after processing.', 'ستظهر هنا إحصاءات النتيجة والمعاينة بعد المعالجة.')}</div>}</aside>
        </section>
      </div>
    </main>
  );
}
