import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ZodType } from 'zod';
import { ImageAssetStore, type StoredImageAsset } from '../../image-core/asset-store';
import { ImageJob } from '../../image-core/job';
import { validateFileSafety, type FileSafetyPolicy } from '../../lib/contracts/file-safety';

export type ImageWorkbenchJobContext<P> = Readonly<{
  assetStore: ImageAssetStore;
  inputAssetId: string;
  inputAsset: StoredImageAsset;
  parameters: P;
}>;

export type ImageWorkbenchControlsContext<P> = Readonly<{
  files: readonly File[];
  input: StoredImageAsset | null;
  parameters: P;
  setParameters: Dispatch<SetStateAction<P>>;
  busy: boolean;
}>;

export type ImageWorkbenchFooterContext = Readonly<{
  files: readonly File[];
  busy: boolean;
}>;

export type ImageWorkbenchProps<P> = Readonly<{
  toolId: string;
  title: string;
  description: string;
  locale?: string;
  inputId?: string;
  accept: string;
  multiple?: boolean;
  parameters: P;
  setParameters: Dispatch<SetStateAction<P>>;
  parameterSchema?: ZodType;
  inputPolicy?: FileSafetyPolicy;
  validateInput?: (file: File, dimensions: { width: number; height: number }) => Promise<void> | void;
  createJob: (context: ImageWorkbenchJobContext<P>) => ImageJob;
  renderControls?: (context: ImageWorkbenchControlsContext<P>) => ReactNode;
  renderFooter?: (context: ImageWorkbenchFooterContext) => ReactNode;
  onFilesChange?: (files: readonly File[]) => void;
  onReset?: () => void;
  runLabel?: string;
  processingLabel?: string;
  resetLabel?: string;
  inputLabel?: string;
  beforeLabel?: string;
  afterLabel?: string;
  noResultLabel?: string;
  downloadLabel?: string;
  downloadRole?: 'link' | 'button';
}>;

type Dimensions = { width: number; height: number };

async function decodeDimensions(file: File): Promise<Dimensions> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to HTMLImageElement for SVG and browsers with partial bitmap support.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    if (!Number.isInteger(image.naturalWidth) || !Number.isInteger(image.naturalHeight) || image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error('The selected image has invalid dimensions.');
    }
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function defaultLabels(locale: string) {
  if (locale.toLowerCase().startsWith('ar')) {
    return {
      run: 'تشغيل الأداة',
      processing: 'جارٍ المعالجة…',
      reset: 'إعادة ضبط',
      input: 'اختر صورة',
      before: 'قبل',
      after: 'بعد',
      noResult: 'No result yet.',
      download: 'تنزيل الآن',
    };
  }
  return {
    run: 'Run tool',
    processing: 'Processing…',
    reset: 'Reset',
    input: 'Choose an image',
    before: 'Before',
    after: 'After',
    noResult: 'No result yet.',
    download: 'Download now',
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'bin';
}

function validateBasicFile(file: File, policy?: FileSafetyPolicy): void {
  if (!policy) return;
  const result = validateFileSafety({ name: file.name, mime: file.type, bytes: file.size }, policy);
  if (!result.safe) throw new Error(`Input rejected by File Safety: ${result.failures.join('; ')}`);
}

export function ToolWorkbench<P>({
  toolId,
  title,
  description,
  locale = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en',
  inputId = 'image-tool-file',
  accept = 'image/png,image/jpeg,image/webp',
  multiple = false,
  parameters,
  setParameters,
  parameterSchema,
  inputPolicy,
  validateInput,
  createJob,
  renderControls,
  renderFooter,
  onFilesChange,
  onReset,
  runLabel,
  processingLabel,
  resetLabel,
  inputLabel,
  beforeLabel,
  afterLabel,
  noResultLabel,
  downloadLabel,
  downloadRole = 'button',
}: ImageWorkbenchProps<P>) {
  const labels = defaultLabels(locale);
  const [files, setFiles] = useState<File[]>([]);
  const [assetStore] = useState(() => new ImageAssetStore());
  const [inputAssetId, setInputAssetId] = useState<string | null>(null);
  const [outputAssetId, setOutputAssetId] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    assetStore.clear();
  }, [assetStore]);

  const handleFiles = async (nextFiles: File[]) => {
    if (busy) return;
    setError('');
    assetStore.clear();
    setFiles(nextFiles);
    setInputAssetId(null);
    setOutputAssetId(null);
    setInputUrl('');
    setOutputUrl('');
    onFilesChange?.(nextFiles);
    const file = nextFiles[0];
    if (!file) return;

    try {
      validateBasicFile(file, inputPolicy);
      const dimensions = await decodeDimensions(file);
      if (inputPolicy) {
        const result = validateFileSafety(
          { name: file.name, mime: file.type, bytes: file.size, width: dimensions.width, height: dimensions.height },
          inputPolicy,
        );
        if (!result.safe) throw new Error(`Input rejected by File Safety: ${result.failures.join('; ')}`);
      }
      await validateInput?.(file, dimensions);
      const id = assetStore.put({ blob: file, width: dimensions.width, height: dimensions.height, name: file.name });
      if (!mountedRef.current) return;
      setInputAssetId(id);
      setInputUrl(assetStore.createObjectURL(id));
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : 'The selected image could not be accepted.');
    }
  };

  const run = async () => {
    if (busy || !inputAssetId) return;
    setBusy(true);
    setError('');
    if (outputAssetId) {
      assetStore.delete(outputAssetId);
      setOutputAssetId(null);
      setOutputUrl('');
    }

    try {
      const validatedParameters = parameterSchema ? parameterSchema.parse(parameters) : parameters;
      const inputAsset = assetStore.require(inputAssetId);
      const job = createJob({ assetStore, inputAssetId, inputAsset, parameters: validatedParameters as P });
      const completed = await job.run();
      if (!mountedRef.current) return;
      const nextUrl = assetStore.createObjectURL(completed.result.outputAssetId);
      setOutputAssetId(completed.result.outputAssetId);
      setOutputUrl(nextUrl);
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : 'Image processing failed.');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const reset = () => {
    if (busy) return;
    assetStore.clear();
    setFiles([]);
    setInputAssetId(null);
    setOutputAssetId(null);
    setInputUrl('');
    setOutputUrl('');
    setError('');
    onReset?.();
    onFilesChange?.([]);
  };

  const inputAsset = inputAssetId ? assetStore.get(inputAssetId) ?? null : null;
  const outputAsset = outputAssetId ? assetStore.get(outputAssetId) ?? null : null;
  const outputName = outputAsset?.name ?? `flixo-${toolId}.${extensionForMime(outputAsset?.mimeType ?? 'image/png')}`;
  const commonContext = { files, input: inputAsset, parameters, setParameters, busy } as const;

  return (
    <div lang={locale} dir={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} className="image-tool-shell" data-tool-id={toolId}>
      <div className="image-tool-container">
        <header className="image-tool-header">
          <div>
            <p className="image-tool-eyebrow">FLIXO · IMAGE TOOLS</p>
            <h2>{title}</h2>
            <p className="image-tool-lead">{description}</p>
          </div>
        </header>
        <section className="image-workbench-grid" aria-label={title} aria-busy={busy}>
          <div className="image-workbench-card image-workbench-controls">
            <div className="image-workbench-section-label">IMAGE INPUT</div>
            <label className="image-workbench-upload" htmlFor={inputId}>
              <span>{files.length ? `${files.length} ${files.length === 1 ? 'image selected' : 'images selected'}` : (inputLabel ?? labels.input)}</span>
              <small>{accept.split(',').map((value) => value.replace(/^image\//, '').toUpperCase()).join(' · ')}</small>
            </label>
            <input
              id={inputId}
              className="image-workbench-file"
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))}
            />
            {renderControls?.({ ...commonContext })}
            <div className="image-workbench-actions">
              <button className="primary-button" type="button" disabled={!inputAssetId || busy} aria-disabled={!inputAssetId || busy ? 'true' : 'false'} onClick={() => void run()}>
                {busy ? (processingLabel ?? labels.processing) : (runLabel ?? labels.run)}
              </button>
              {onReset && <button className="secondary-button" type="button" disabled={busy} onClick={reset}>{resetLabel ?? labels.reset}</button>}
            </div>
            {renderFooter?.({ files, busy })}
            {error && <p role="alert" className="error-box">{error}</p>}
            <p className="privacy-note">🔒 Browser-first image processing. The selected file remains in the current browser session unless the tool explicitly uses a remote endpoint.</p>
          </div>

          <section className="image-workbench-card image-workbench-preview" aria-label={beforeLabel ?? labels.before}>
            <div className="image-workbench-section-label">{beforeLabel ?? labels.before}</div>
            {inputUrl ? <img className="image-workbench-image" src={inputUrl} alt={beforeLabel ?? labels.before} /> : <div className="preview-placeholder">Choose an image to preview it here.</div>}
            {inputAsset && <dl className="image-workbench-stats"><div><dt>Dimensions</dt><dd>{inputAsset.width} × {inputAsset.height}</dd></div><div><dt>Size</dt><dd>{formatBytes(inputAsset.size)}</dd></div><div><dt>Format</dt><dd>{inputAsset.mimeType || 'unknown'}</dd></div></dl>}
          </section>

          <section className="image-workbench-card image-workbench-output" aria-live="polite" aria-label={afterLabel ?? labels.after}>
            <div className="image-workbench-section-label">{afterLabel ?? labels.after}</div>
            {outputAsset && outputUrl ? (
              <>
                <img className="image-workbench-image" src={outputUrl} alt="Tool result" />
                <dl className="image-workbench-stats"><div><dt>Dimensions</dt><dd>{outputAsset.width} × {outputAsset.height}</dd></div><div><dt>Size</dt><dd>{formatBytes(outputAsset.size)}</dd></div><div><dt>Format</dt><dd>{outputAsset.mimeType || 'unknown'}</dd></div>{inputAsset && <div><dt>Change</dt><dd>{Math.round((1 - outputAsset.size / inputAsset.size) * 100)}%</dd></div>}</dl>
                <a className="download-button" href={outputUrl} download={outputName} role={downloadRole === 'button' ? 'button' : undefined} aria-label={downloadLabel ?? labels.download}>
                  {downloadLabel ?? labels.download}
                </a>
              </>
            ) : (
              <div className="empty-result">{noResultLabel ?? labels.noResult}</div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
