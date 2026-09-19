import { useState } from 'react';
import { ToolWorkbench } from '../../components/image-tool/ToolWorkbench';
import { ImageJob } from '../../image-core/job';
import { getToolDefinition } from '../../config/canonical-tool-definition';
import { validateUploadBoundary } from '../../lib/contracts/upload-boundary';
import { validateOutputIntegrity } from '../../lib/contracts/output-integrity';
import { cropResizeImage } from '../image-toolkit/engine';
import { imageCropperIntegritySpec } from './output-integrity';

type Parameters = {
  x: number;
  y: number;
  cropWidth: number;
  cropHeight: number;
  width: number;
  height: number;
};

const definition = getToolDefinition('image-cropper');

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
  en: {
    title: 'Image Cropper',
    description: 'Crop and resize images with one shared image workbench and exact output dimensions.',
    x: 'X',
    y: 'Y',
    cropWidth: 'Crop width',
    cropHeight: 'Crop height',
    outputWidth: 'Output width',
    outputHeight: 'Output height',
  },
  ar: {
    title: 'قص الصور',
    description: 'اقتصص الصور وغيّر أبعادها داخل المتصفح باستخدام مساحة عمل موحدة.',
    x: 'X',
    y: 'Y',
    cropWidth: 'عرض الاقتصاص',
    cropHeight: 'ارتفاع الاقتصاص',
    outputWidth: 'عرض الإخراج',
    outputHeight: 'ارتفاع الإخراج',
  },
} as const;

export function ImageCropperTool({ locale }: { locale?: string }) {
  const resolvedLocale = locale ?? (typeof document !== 'undefined' ? document.documentElement.lang : 'en');
  const lang = resolvedLocale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const [parameters, setParameters] = useState<Parameters>({ x: 0, y: 0, cropWidth: 500, cropHeight: 500, width: 500, height: 500 });

  return (
    <ToolWorkbench
      toolId="image-cropper"
      title={copy[lang].title}
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
          toolId: 'image-cropper',
          inputAssetId,
          assetStore,
          parameters: next,
          processor: async (input) => {
            const blob = await cropResizeImage(input.blob, { x: next.x, y: next.y, width: next.cropWidth, height: next.cropHeight }, { width: next.width, height: next.height });
            return { blob, width: next.width, height: next.height, name: 'flixo-cropped.png' };
          },
          verifier: async (_input, output, params) => {
            const nextParameters = params as Parameters;
            const bytes = new Uint8Array(await output.blob.arrayBuffer());
            const validation = validateOutputIntegrity(output.size, output.mimeType, imageCropperIntegritySpec, { width: output.width, height: output.height }, { filename: output.name, bytes });
            if (!validation.valid) return validation;
            if (output.width !== nextParameters.width || output.height !== nextParameters.height) {
              return { valid: false, failures: ['output dimensions do not match requested dimensions'] };
            }
            return validation;
          },
        });
      }}
      renderControls={({ parameters: current, setParameters: update }) => {
        const next = current as Parameters;
        const fields: Array<[keyof Parameters, string]> = [['x', copy[lang].x], ['y', copy[lang].y], ['cropWidth', copy[lang].cropWidth], ['cropHeight', copy[lang].cropHeight], ['width', copy[lang].outputWidth], ['height', copy[lang].outputHeight]];
        return <div className="image-workbench-control-grid">{fields.map(([key, label]) => <label key={key}><span>{label}</span><input aria-label={label} inputMode="numeric" value={next[key]} onChange={(event) => update((value) => ({ ...value, [key]: Number(event.target.value) }))} /></label>)}</div>;
      }}
      onReset={() => setParameters({ x: 0, y: 0, cropWidth: 500, cropHeight: 500, width: 500, height: 500 })}
      runLabel="Run tool"
      downloadLabel="Download now"
      downloadRole="button"
    />
  );
}
