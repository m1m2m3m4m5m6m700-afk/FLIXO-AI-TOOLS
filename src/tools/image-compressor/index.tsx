import { useState } from 'react';
import { ToolWorkbench } from '../../components/image-tool/ToolWorkbench';
import { ImageJob } from '../../image-core/job';
import { getToolDefinition } from '../../config/canonical-tool-definition';
import { validateOutputIntegrity } from '../../lib/contracts/output-integrity';
import { imageCompressorOutputIntegrity } from './output-contract';
import { assertSafeImageInput } from './file-safety';
import type { CompressionFormat } from './engine';
import { compressImage, MAX_FILES, MAX_INPUT_SIZE } from './engine';
import { localizeToolUiValue } from '../../lib/i18n/tool-ui-runtime-completeness';

type Parameters = {
  quality?: number;
  format?: CompressionFormat;
  targetSizeKB?: number;
  maxWidth?: number;
  maxHeight?: number;
};

const definition = getToolDefinition('image-compressor');
const parameterSchema = definition?.parameterSchema;

const copy = {
  en: {
    title: 'Image Compressor',
    description: 'Compress JPG, PNG, and WebP images locally in one shared image workbench.',
    format: 'Output format',
    quality: 'Quality',
    target: 'Target size (KB)',
    maxWidth: 'Max width',
    maxHeight: 'Max height',
    compress: 'Compress image',
    reset: 'Reset',
    batch: 'Compress all to ZIP',
    downloadZip: 'Download ZIP',
  },
  ar: {
    title: 'ضغط الصور أونلاين',
    description: 'قلّل حجم صور JPG وPNG وWebP محليًا داخل المتصفح.',
    format: 'صيغة الإخراج',
    quality: 'الجودة',
    target: 'الحجم المستهدف (KB)',
    maxWidth: 'أقصى عرض',
    maxHeight: 'أقصى ارتفاع',
    compress: 'ضغط الصورة',
    reset: 'إعادة ضبط',
    batch: 'ضغط الكل إلى ZIP',
    downloadZip: 'تنزيل ZIP',
  },
} as const;

function extensionFor(format: CompressionFormat): string {
  return format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';
}

function makeFile(input: { blob: Blob; mimeType: string; name?: string }): File {
  return new File([input.blob], input.name ?? 'image', { type: input.mimeType });
}

export function ImageCompressor({ locale }: { locale?: string }) {
  const resolvedLocale = locale ?? (typeof document !== 'undefined' ? document.documentElement.lang : 'en');
  const lang = resolvedLocale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const t = (value: string) => localizeToolUiValue(resolvedLocale, value, 'image-compressor');
  const ui = copy[lang];
  const localizedUi = Object.fromEntries(Object.entries(ui).map(([key, value]) => [key, t(value)])) as typeof ui;
  const [parameters, setParameters] = useState<Parameters>({ quality: 0.82, format: 'image/webp' });
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchZipUrl, setBatchZipUrl] = useState('');

  const runBatch = async (files: readonly File[]) => {
    if (batchBusy || files.length < 2) return;
    setBatchBusy(true);
    setBatchError('');
    if (batchZipUrl) URL.revokeObjectURL(batchZipUrl);
    setBatchZipUrl('');
    try {
      const selected = files.slice(0, MAX_FILES).filter((file) => file.size <= MAX_INPUT_SIZE);
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const format = parameters.format ?? 'image/webp';
      for (const file of selected) {
        const compressed = await compressImage(file, {
          quality: parameters.quality ?? 0.82,
          format,
          maxWidth: parameters.maxWidth,
          maxHeight: parameters.maxHeight,
          targetSizeKB: parameters.targetSizeKB,
        });
        const outputBytes = new Uint8Array(await compressed.blob.arrayBuffer());
        const outputName = `${file.name.replace(/\.[^.]+$/, '') || 'image'}-flixo.${extensionFor(format)}`;
        const validation = validateOutputIntegrity(
          compressed.blob.size,
          compressed.blob.type || format,
          imageCompressorOutputIntegrity,
          { width: compressed.width, height: compressed.height },
          { filename: outputName, bytes: outputBytes },
        );
        if (!validation.valid) throw new Error(`Batch output integrity validation failed: ${validation.failures.join('; ')}`);
        zip.file(outputName, compressed.blob);
      }
      if (!selected.length) throw new Error('No valid image files remain for batch processing.');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
      const zipValidation = validateOutputIntegrity(zipBlob.size, 'application/zip', {
        toolId: 'image-compressor',
        allowedMime: ['application/zip'],
        minBytes: 1,
        maxBytes: 25 * 1024 * 1024,
        allowedExtensions: ['zip'],
        signatures: ['504b0304'],
      }, undefined, { filename: 'flixo-compressed-images.zip', bytes: zipBytes });
      if (!zipValidation.valid) throw new Error(`ZIP output integrity validation failed: ${zipValidation.failures.join('; ')}`);
      setBatchZipUrl(URL.createObjectURL(zipBlob));
    } catch (cause) {
      setBatchError(cause instanceof Error ? cause.message : 'Batch compression failed.');
    } finally {
      setBatchBusy(false);
    }
  };

  const reset = () => {
    setParameters({ quality: 0.82, format: 'image/webp' });
    setBatchError('');
    if (batchZipUrl) URL.revokeObjectURL(batchZipUrl);
    setBatchZipUrl('');
  };

  return (
    <ToolWorkbench
      toolId="image-compressor"
      title={localizedUi.title}
      description={localizedUi.description}
      locale={resolvedLocale}
      inputId="image-file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml"
      multiple
      parameters={parameters}
      setParameters={setParameters}
      parameterSchema={parameterSchema}
      validateInput={(file, dimensions) => assertSafeImageInput(file, dimensions)}
      createJob={({ assetStore, inputAssetId, parameters: validated }) => {
        const next = validated as Parameters;
        return new ImageJob({
          toolId: 'image-compressor',
          inputAssetId,
          assetStore,
          parameters: next,
          processor: async (input, params) => {
            const options = params as Parameters;
            const compressed = await compressImage(makeFile(input), {
              quality: options.quality ?? 0.82,
              format: options.format ?? 'image/webp',
              targetSizeKB: options.targetSizeKB,
              maxWidth: options.maxWidth,
              maxHeight: options.maxHeight,
            });
            return {
              blob: compressed.blob,
              width: compressed.width,
              height: compressed.height,
              name: `flixo-compressed.${extensionFor(compressed.mimeType)}`,
            };
          },
          verifier: async (_input, output, params) => {
            const options = params as Parameters;
            const bytes = new Uint8Array(await output.blob.arrayBuffer());
            const validation = validateOutputIntegrity(
              output.size,
              output.mimeType,
              imageCompressorOutputIntegrity,
              { width: output.width, height: output.height },
              { filename: output.name, bytes },
            );
            if (!validation.valid) return validation;
            const target = options.targetSizeKB;
            if (target && output.size > target * 1024) return { valid: false, failures: [`output exceeds target size of ${target} KB`] };
            return validation;
          },
        });
      }}
      renderControls={({ parameters: current, setParameters: update, busy }) => {
        const next = current as Parameters;
        return (
          <div className="image-workbench-control-grid">
            <label><span>{localizedUi.format}</span><select value={next.format ?? 'image/webp'} disabled={busy} onChange={(event) => update((value) => ({ ...value, format: event.target.value as CompressionFormat }))}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
            <label><span>{localizedUi.quality} ({Math.round((next.quality ?? 0.82) * 100)}%)</span><input type="range" min="0.1" max="1" step="0.05" value={next.quality ?? 0.82} disabled={busy} onChange={(event) => update((value) => ({ ...value, quality: Number(event.target.value) }))} /></label>
            <label><span>{localizedUi.target}</span><input inputMode="numeric" value={next.targetSizeKB ?? ''} placeholder={t("Optional")} disabled={busy} onChange={(event) => update((value) => ({ ...value, targetSizeKB: event.target.value ? Number(event.target.value) : undefined }))} /></label>
            <label><span>{localizedUi.maxWidth}</span><input inputMode="numeric" value={next.maxWidth ?? ''} placeholder={t("Auto")} disabled={busy} onChange={(event) => update((value) => ({ ...value, maxWidth: event.target.value ? Number(event.target.value) : undefined }))} /></label>
            <label><span>{localizedUi.maxHeight}</span><input inputMode="numeric" value={next.maxHeight ?? ''} placeholder="Auto" disabled={busy} onChange={(event) => update((value) => ({ ...value, maxHeight: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          </div>
        );
      }}
      renderFooter={({ files, busy }) => (
        <>
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={busy || batchBusy || files.length < 2} onClick={() => void runBatch(files)}>{batchBusy ? t('Processing…') : localizedUi.batch}</button>
            {batchZipUrl && <a className="download-button" href={batchZipUrl} download="flixo-compressed-images.zip">{localizedUi.downloadZip}</a>}
          </div>
          {batchError && <p role="alert" className="error-box">{batchError}</p>}
        </>
      )}
      onFilesChange={() => setBatchError('')}
      onReset={reset}
      runLabel={localizedUi.compress}
      resetLabel={localizedUi.reset}
      downloadLabel={t("Download image")}
      downloadRole="link"
      inputLabel={t("Choose images")}
      beforeLabel={t("Before")}
      afterLabel={t("After")}
      noResultLabel={t("No result yet.")}
    />
  );
}