import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ZodType } from 'zod';
import { ImageAssetStore, type StoredImageAsset } from '../../image-core/asset-store';
import { getToolDefinition } from '../../config/canonical-tool-definition';
import { LOCALES, type Locale } from '../../lib/i18n';
import './ToolWorkbench.css';
import { localizeToolUiValue } from '../../lib/i18n/tool-ui-runtime-completeness';
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

const LANGUAGE_LABELS: Readonly<Record<Locale, string>> = {
  ar: 'العربية', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी',
  id: 'Bahasa Indonesia', it: 'Italiano', ja: '日本語', ko: '한국어', ms: 'Bahasa Melayu',
  nl: 'Nederlands', pl: 'Polski', pt: 'Português', ru: 'Русский', sv: 'Svenska',
  th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt',
};

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
  beforeLabel,
  afterLabel,
  noResultLabel,
  downloadLabel,
  downloadRole = 'button',
}: ImageWorkbenchProps<P>) {
  const navigate = useNavigate();
  const labels = defaultLabels(locale);
  const t = (value: string) => localizeToolUiValue(locale, value, toolId);
  const definition = getToolDefinition(toolId);
  const toolCategory = definition?.category ?? 'Images';
  const [files, setFiles] = useState<File[]>([]);
  const [assetStore] = useState(() => new ImageAssetStore());
  const [inputAssetId, setInputAssetId] = useState<string | null>(null);
  const [outputAssetId, setOutputAssetId] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'compare' | 'before' | 'after'>('compare');
  const [zoom, setZoom] = useState(1);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(true);
  const [preset, setPreset] = useState<'default' | 'clean' | 'warm'>('default');
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    assetStore.clear();
  }, [assetStore]);

  const loadInputFile = async (file: File): Promise<void> => {
    setError('');
    assetStore.clear();
    setInputAssetId(null);
    setOutputAssetId(null);
    setInputUrl('');
    setOutputUrl('');

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
  };

  const handleFiles = async (nextFiles: File[], nextActiveIndex = 0) => {
    if (busy) return;
    setFiles(nextFiles);
    setError('');
    onFilesChange?.(nextFiles);
    const file = nextFiles[Math.max(0, Math.min(nextActiveIndex, Math.max(0, nextFiles.length - 1)))];
    if (!file) {
      assetStore.clear();
      setInputAssetId(null);
      setOutputAssetId(null);
      setInputUrl('');
      setOutputUrl('');
      return;
    }
    try {
      await loadInputFile(file);
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
    setPreset('default');
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
    <div lang={locale} dir={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} className="flixo-tool-page" data-tool-id={toolId} data-flixo-i18n-root>
      <header className="flixo-tool-topbar">
        <div className="flixo-tool-topbar-group">
          <img className="flixo-tool-brand-mark" src="/flixo-brand-mark.webp" alt="FLIXO" width={34} height={34} />
          <button type="button" className="flixo-tool-back" title={t('Back')} onClick={() => window.history.back()}>‹</button>
          <div className="flixo-tool-id">
            <strong>{title}</strong>
            <span className="mono">{toolCategory}</span>
          </div>
        </div>
        <div className="flixo-tool-mode" role="tablist" aria-label={t('Mode')}>
          <button type="button" className="active">{t('Edit')}</button>
          <button type="button">{t('Batch')}</button>
        </div>
        <div className="flixo-tool-topbar-group">
          <div className="flixo-tool-history">
            <button type="button" className="flixo-tool-icon-btn" title={t('Undo')} disabled>↶</button>
            <button type="button" className="flixo-tool-icon-btn" title={t('Redo')} disabled>↷</button>
          </div>
          <div className="flixo-tool-topbar-actions">
            <label className="flixo-tool-language-switch" title={t('Change language')}>
              <span aria-hidden="true">🌐</span>
              <select
                value={locale as Locale}
                aria-label={t('Change language')}
                onChange={(event) => {
                  const next = event.target.value as Locale;
                  void navigate({
                    to: '/$locale/$tool',
                    params: { locale: next, tool: toolId },
                  });
                }}
              >
                {LOCALES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}
              </select>
            </label>
            <button type="button" className="flixo-tool-export" disabled={!outputUrl} onClick={() => { if (outputUrl) window.open(outputUrl, '_blank', 'noopener,noreferrer'); }}>
              {t('Export result')}
            </button>
          </div>
        </div>
      </header>

      <section className="flixo-tool-workspace image-workbench-grid" aria-label={title} aria-busy={busy}>
        <aside className="flixo-tool-side left" id="flixo-tool-left-panel">
          <div className="flixo-tool-panel-scroll">
            <div>
              <div className="flixo-tool-block-title">{t('Source file')}</div>
              <label className="flixo-tool-drop" htmlFor={inputId}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
                <div>{t('Drop a file here or ')}<strong>{t('browse your device')}</strong></div>
                <small>{accept.split(',').map((value) => value.replace(/^image\//, '').toUpperCase()).join(' · ')}{multiple ? ` · ${t('MULTI')}` : ''}</small>
                {files[0] && <div className="flixo-tool-file-name">{files[0].name}</div>}
              </label>
              <input id={inputId} className="flixo-tool-file" type="file" accept={accept} multiple={multiple} onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))} />
            </div>

            <div>
              <div className="flixo-tool-block-title">{t('Presets')}</div>
              <div className="flixo-tool-presets">
                <button type="button" className="flixo-tool-preset active"><span className="flixo-tool-swatch" />{t('Default')}</button>
                <button type="button" className="flixo-tool-preset"><span className="flixo-tool-swatch" style={{ background: '#fff' }} />{t('Clean')}</button>
                <button type="button" className="flixo-tool-preset"><span className="flixo-tool-swatch" style={{ background: 'linear-gradient(135deg,#123a34,#2a1a10)' }} />{t('Warm')}</button>
              </div>
            </div>

            <div>
              <div className="flixo-tool-block-title">{t('Layers & state')}</div>
              <div className="flixo-tool-layers">
                <div className="flixo-tool-layer"><span>{t('Source')}</span><span>{inputAsset ? t('loaded') : t('empty')}</span></div>
                <div className="flixo-tool-layer"><span>{t('Result')}</span><span>{outputAsset ? t('ready') : t('empty')}</span></div>
              </div>
            </div>

            <p className="flixo-tool-description">{description}</p>
          </div>
        </aside>

        <main className="flixo-tool-canvas image-workbench-preview">
          <div className="flixo-tool-canvas-toolbar">
            <div className="flixo-tool-view-toggle" role="tablist" aria-label={t('Preview')}>
              {([
                ['compare', t('Compare')],
                ['before', locale.toLowerCase().startsWith('ar') ? 'قبل' : 'Before'],
                ['after', t('After')],
              ] as const).map(([mode, label]) => (
                <button key={mode} type="button" className={`flixo-tool-view-btn ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>{label}</button>
              ))}
            </div>
            <div className="flixo-tool-zoom mono">
              <button type="button" onClick={() => setZoom((value) => Math.max(.5, Number((value - .25).toFixed(2))))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(2, Number((value + .25).toFixed(2))))}>+</button>
            </div>
          </div>

          <div className="flixo-tool-canvas-stage">
            <div className="flixo-tool-canvas-card image-workbench-output">
              {viewMode === 'compare' ? (
                <div className="flixo-tool-preview-grid compare">
                  <div className="flixo-tool-preview-pane">
                    {inputUrl ? <img src={inputUrl} alt={beforeLabel ?? labels.before} style={{ transform: `scale(${zoom})` }} /> : <div className="flixo-tool-preview-placeholder">◩<div>{t('No file yet')}</div><small>{t('Upload a file from the source panel')}</small></div>}
                    <span className="flixo-tool-preview-label mono">{beforeLabel ?? labels.before}</span>
                  </div>
                  <div className="flixo-tool-preview-pane">
                    {outputUrl ? <img src={outputUrl} alt="Tool result" style={{ transform: `scale(${zoom})` }} /> : <div className="flixo-tool-preview-placeholder">◩<div>{noResultLabel ?? labels.noResult}</div><small>{t('Run the tool after selecting a file')}</small></div>}
                    <span className="flixo-tool-preview-label mono">{afterLabel ?? labels.after}</span>
                  </div>
                </div>
              ) : (
                <div className="flixo-tool-preview-grid">
                  <div className="flixo-tool-preview-pane">
                    {viewMode === 'before' && inputUrl ? <img src={inputUrl} alt={beforeLabel ?? labels.before} style={{ transform: `scale(${zoom})` }} /> : null}
                    {viewMode === 'after' && outputUrl ? <img src={outputUrl} alt={afterLabel ?? labels.after} style={{ transform: `scale(${zoom})` }} /> : null}
                    {((viewMode === 'before' && !inputUrl) || (viewMode === 'after' && !outputUrl)) && <div className="flixo-tool-preview-placeholder">◩<div>{viewMode === 'before' ? t('No input yet') : (noResultLabel ?? labels.noResult)}</div></div>}
                    <span className="flixo-tool-preview-label mono">{viewMode === 'before' ? (beforeLabel ?? labels.before) : (afterLabel ?? labels.after)}</span>
                  </div>
                </div>
              )}
              {inputAsset && <div className="flixo-tool-stats"><span>{inputAsset.width}×{inputAsset.height}</span><span>{formatBytes(inputAsset.size)}</span><span>{inputAsset.mimeType || 'unknown'}</span>{outputAsset && <><span>{outputAsset.width}×{outputAsset.height}</span><span>{formatBytes(outputAsset.size)}</span><span>{outputAsset.mimeType || 'unknown'}</span></>}</div>}
            </div>
          </div>

          <div className={`flixo-tool-progress ${busy ? 'busy' : ''}`}>
            <span className="flixo-tool-progress-label mono">{busy ? (processingLabel ?? labels.processing) : (outputAsset ? (t('Complete')) : (locale.toLowerCase().startsWith('ar') ? 'جاهز' : 'Ready'))}</span>
            <div className="flixo-tool-progress-bar"><div className="flixo-tool-progress-fill" /></div>
            <span className="flixo-tool-progress-value mono">{busy ? 'RUN' : outputAsset ? '100%' : '0%'}</span>
          </div>
        </main>

        <aside className="flixo-tool-side right" id="flixo-tool-right-panel">
          <div className="flixo-tool-panel-scroll">
            <div className={`flixo-tool-adjust ${adjustmentsOpen ? '' : 'collapsed'}`}>
              <button
                type="button"
                className="flixo-tool-adjust-title"
                onClick={() => setAdjustmentsOpen((value) => !value)}
                aria-expanded={adjustmentsOpen}
              >
                <span>{t('Adjustments')}</span>
                <span className="flixo-tool-chevron" aria-hidden="true">⌄</span>
              </button>
              <div className="flixo-tool-adjust-body">
                {renderControls?.({ ...commonContext }) ?? <p className="flixo-tool-adjust-empty">{locale.toLowerCase().startsWith('ar') ? 'لا توجد إعدادات مخصصة لهذه الأداة.' : 'No custom controls for this tool.'}</p>}
              </div>
            </div>
            <div className="flixo-tool-adjust">
              <button
                type="button"
                className="flixo-tool-adjust-title"
                onClick={() => setPreset((value) => value === 'default' ? 'clean' : value === 'clean' ? 'warm' : 'default')}
                aria-label={t('Change preset')}
              >
                <span>{t('Active preset')}</span>
                <span className="mono">{preset === 'default' ? t('DEFAULT') : t(preset.toUpperCase())}</span>
              </button>
              <p className="flixo-tool-adjust-empty">
                {preset === 'default'
                  ? (t('Default tool preset.'))
                  : preset === 'clean'
                    ? (t('Clean editing preset.'))
                    : (t('Warm output preset.'))}
              </p>
            </div>
            <div className="flixo-tool-actions">
              <button className="primary-button flixo-tool-action-primary" type="button" disabled={!inputAssetId || busy} aria-disabled={!inputAssetId || busy ? 'true' : 'false'} onClick={() => void run()}>{busy ? (processingLabel ?? labels.processing) : (runLabel ?? labels.run)}</button>
              {onReset && <button className="secondary-button" type="button" disabled={busy} onClick={reset}>{resetLabel ?? labels.reset}</button>}
            </div>
            {renderFooter?.({ files, busy })}
            {error && <p role="alert" className="flixo-tool-error">{error}</p>}
            {outputAsset && outputUrl && <a className="download-button" href={outputUrl} download={outputName} role={downloadRole === 'button' ? 'button' : undefined}>{downloadLabel ?? labels.download}</a>}
            <p className="flixo-tool-footer-note">🔒 {t('Browser-first processing follows the existing tool contracts.')}</p>
          </div>
        </aside>
      </section>

      <nav className="flixo-tool-mobile-bar" aria-label={t('Tool panels')}>
        <button type="button" id="flixo-tool-open-left" onClick={() => document.getElementById('flixo-tool-left-panel')?.classList.toggle('open')}>{t('Source')}</button>
        <button type="button" id="flixo-tool-open-right" onClick={() => document.getElementById('flixo-tool-right-panel')?.classList.toggle('open')}>{t('Adjustments')}</button>
      </nav>
    </div>
  );
}
