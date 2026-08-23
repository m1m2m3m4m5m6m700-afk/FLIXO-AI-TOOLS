import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage, MAX_FILES, MAX_INPUT_SIZE, type CompressionFormat } from './engine';

const formatLabels: Record<CompressionFormat, string> = {
  'image/webp': 'WebP',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

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

export function ImageCompressor({ locale = 'en' }: { locale?: 'en' | 'ar' }) {
  const isArabic = locale === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
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
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState('');
  const [outputPreviewUrl, setOutputPreviewUrl] = useState('');
  const [batchZipUrl, setBatchZipUrl] = useState('');
  const [batchCount, setBatchCount] = useState(0);

  const file = files[0] ?? null;
  const savings = useMemo(() => {
    if (!file || !result) return 0;
    return Math.max(0, Math.round((1 - result.blob.size / file.size) * 100));
  }, [file, result]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSourcePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      if (outputPreviewUrl) URL.revokeObjectURL(outputPreviewUrl);
      if (batchZipUrl) URL.revokeObjectURL(batchZipUrl);
    };
  }, [downloadUrl, outputPreviewUrl, batchZipUrl]);

  const selectFiles = (nextFiles: File[]) => {
    setError('');
    setResult(null);
    setBatchZipUrl('');
    const selected = nextFiles.slice(0, MAX_FILES).filter((nextFile) => nextFile.size <= MAX_INPUT_SIZE);
    const rejectedCount = nextFiles.length - selected.length;
    if (rejectedCount > 0) {
      setError(label(locale, `Some files were skipped. Maximum ${MAX_FILES} files and ${formatBytes(MAX_INPUT_SIZE)} per file.`, `تم تجاهل بعض الملفات. الحد الأقصى ${MAX_FILES} ملفًا و${formatBytes(MAX_INPUT_SIZE)} لكل ملف.`));
    }
    if (selected.length === 0) setSourcePreviewUrl('');
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
    if (!file) return;
    setBusy(true);
    setError('');
