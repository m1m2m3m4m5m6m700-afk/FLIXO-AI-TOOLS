import { useState } from 'react';
import { ToolWorkbench } from '../../components/image-tool/ToolWorkbench';
import { ImageJob } from '../../image-core/job';
import { getToolDefinition } from '../../config/canonical-tool-definition';
import { validateUploadBoundary } from '../../lib/contracts/upload-boundary';
import { validateOutputIntegrity } from '../../lib/contracts/output-integrity';
import { convertImage } from '../image-toolkit/engine';
import { imageConverterIntegritySpec } from './output-integrity';
import { localizeToolUiValue } from '../../lib/i18n/tool-ui-runtime-completeness';

type Parameters = { format: 'image/png' | 'image/jpeg' | 'image/webp' };

const definition = getToolDefinition('image-converter');

async function validateInput(file: File, dimensions: { width: number; height: number }) {
  const signature = file.type === 'image/png' ? ['89504e470d0a1a0a'] : file.type === 'image/jpeg' ? ['ffd8ff'] : ['52494646'];
  const extensions = file.type === 'image/png' ? ['png'] : file.type === 'image/jpeg' ? ['jpg', 'jpeg'] : ['webp'];
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const result = validateUploadBoundary(
    { name: file.name, mime: file.type, bytes, width: dimensions.width, height: dimensions.height },
    { allowedMime: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 25 * 1024 * 1024, maxPixels: 40_000_000, signatures: signature, allowedExtensions: extensions },
  );
  if (!result.safe) throw new Error(`Input rejected by Upload Security Boundary: ${result.failures.join('; ')}`);
}

const copy = {
  en: { title: 'Image Converter', description: 'Convert PNG, JPG, and WebP images locally with one shared image workbench.', format: 'Output format' },
  ar: { title: 'محول الصور', description: 'حوّل صور PNG وJPG وWebP محليًا داخل المتصفح.', format: 'صيغة الإخراج' },
} as const;

export function ImageConverterTool({ locale }: { locale?: string }) {
  const resolvedLocale = locale ?? (typeof document !== 'undefined' ? document.documentElement.lang : 'en');
  const lang = resolvedLocale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const t = (value: string) => localizeToolUiValue(resolvedLocale, value, 'image-converter');
  const [parameters, setParameters] = useState<Parameters>({ format: 'image/webp' });

  return (
    <ToolWorkbench
      toolId="image-converter"
      title={t(copy[lang].title)}
      description={copy[lang].description}
      locale={resolvedLocale}
      inputId="image-tool-file"
      accept="image/png,image/jpeg,image/webp"
      parameters={parameters}
      setParameters={setParameters}
      parameterSchema={definition?.parameterSchema}
      inputPolicy={{ allowedMime: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 25 * 1024 * 1024, maxPixels: 40_000_000 }}
      validateInput={validateInput}
      createJob={({ assetStore, inputAssetId, parameters: validated }) => {
        const next = validated as Parameters;
        return new ImageJob({
          toolId: 'image-converter',
          inputAssetId,
          assetStore,
          parameters: next,
          processor: async (input) => {
            const blob = await convertImage(input.blob, next.format);
            return { blob, width: input.width, height: input.height, name: `flixo-converted.${next.format === 'image/jpeg' ? 'jpg' : next.format === 'image/webp' ? 'webp' : 'png'}` };
          },
          verifier: async (_input, output, params) => {
            const selected = (params as Parameters).format;
            const bytes = new Uint8Array(await output.blob.arrayBuffer());
            const validation = validateOutputIntegrity(output.size, output.mimeType, imageConverterIntegritySpec, { width: output.width, height: output.height }, { filename: output.name, bytes });
            if (!validation.valid) return validation;
            if (output.mimeType !== selected) return { valid: false, failures: [`output MIME does not match requested format: expected ${selected}, received ${output.mimeType}`] };
            return validation;
          },
        });
      }}
      renderControls={({ parameters: current, setParameters: update }) => (
        <div className="image-workbench-control-grid">
          <label><span>{t(copy[lang].format)}</span><select aria-label={t(copy[lang].format)} value={(current as Parameters).format} onChange={(event) => update((value) => ({ ...value, format: event.target.value as Parameters['format'] }))}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
        </div>
      )}
      onReset={() => setParameters({ format: 'image/webp' })}
      runLabel={t("Run tool")}
      downloadLabel={t("Download now")}
      downloadRole="button"
    />
  );
}
