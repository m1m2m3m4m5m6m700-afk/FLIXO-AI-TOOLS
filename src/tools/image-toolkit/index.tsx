import { useEffect, useMemo, useState } from 'react';
import { convertImage, cropResizeImage, downloadBlob, imageInfo, removeBackground, rasterToSvg, resizeImage, watermarkRemove, fillRemoveRegion } from './engine';
import { recognizeWithOcrWorker } from './ocr-worker-client';
import { assertImageCropperOutputIntegrity } from '../image-cropper/output-integrity';
import type { LocalToolId } from './engine';

const DEFINITIONS: Record<Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>, { title: string; description: string; accept: string }> = {
  'background-remover': { title: 'Background Remover', description: 'Remove connected, uniform backgrounds locally in your browser with edge-aware flood fill.', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  'image-upscaler': { title: 'Image Upscaler', description: 'Increase image dimensions with high-quality browser resampling and controlled sharpening.', accept: 'image/png,image/jpeg,image/webp' },
  'image-converter': { title: 'Image Converter', description: 'Convert images between PNG, JPG, and WebP without uploading them.', accept: 'image/png,image/jpeg,image/webp' },
  'image-to-text': { title: 'Image to Text OCR', description: 'Extract visible text from an image in your browser with OCR preprocessing.', accept: 'image/png,image/jpeg,image/webp' },
  'object-remover': { title: 'Object Remover', description: 'Reconstruct a selected rectangular object region from surrounding pixels locally.', accept: 'image/png,image/jpeg,image/webp' },
  'crop-resize': { title: 'Crop & Resize', description: 'Crop an image and export it at exact dimensions.', accept: 'image/png,image/jpeg,image/webp' },
  'watermark-remover': { title: 'Watermark Remover', description: 'Reconstruct a selected watermark region locally with edge interpolation.', accept: 'image/png,image/jpeg,image/webp' },
  'raster-to-svg': { title: 'Raster to SVG', description: 'Convert a small raster image to compact pixel-based SVG locally.', accept: 'image/png,image/jpeg,image/webp' },
};

type Props = { toolId: Exclude<LocalToolId, 'image-compressor'> };
type Result = { blob: Blob; text?: string; fileName: string; info?: { width: number; height: number } };

function baseName(name: string) { return name.replace(/\.[^.]+$/, '') || 'flixo-image'; }

function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

async function preprocessForOcr(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(2.5, Math.max(1, 1600 / Math.max(image.width, image.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < data.data.length; index += 4) {
    const luminance = 0.2126 * data.data[index] + 0.7152 * data.data[index + 1] + 0.0722 * data.data[index + 2];
    const boosted = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
    data.data[index] = boosted;
    data.data[index + 1] = boosted;
    data.data[index + 2] = boosted;
  }
  context.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare OCR input.')), 'image/png'));
}

export function ImageToolPage({ toolId }: Props) {
  const isGenerator = toolId === 'ai-image-generator';
  const definition = isGenerator
    ? { title: 'AI Image Generator', description: 'Generate an image through the configured FLIXO image model endpoint.', accept: '' }
    : DEFINITIONS[toolId];

  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp');
  const [scale, setScale] = useState('2');
  const [tolerance, setTolerance] = useState('42');
  const [columns, setColumns] = useState('48');
  const [cropX, setCropX] = useState('0');
  const [cropY, setCropY] = useState('0');
  const [cropW, setCropW] = useState('500');
  const [cropH, setCropH] = useState('500');
  const [outW, setOutW] = useState('500');
  const [outH, setOutH] = useState('500');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const previewUrl = useObjectUrl(result?.blob.type.startsWith('image/') ? result.blob : null);
  const downloadUrl = useObjectUrl(result?.blob ?? null);

  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (isGenerator) {
        if (!prompt.trim()) throw new Error('Enter a prompt first.');
        const body = new FormData();
        body.append('capability', 'generate-image');
        body.append('prompt', prompt.trim());
        const response = await fetch(import.meta.env.VITE_FLIXO_AI_IMAGE_ENDPOINT || '/api/ai/image', { method: 'POST', body });
        if (!response.ok) throw new Error('AI image endpoint is not configured or returned an error.');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('AI endpoint did not return an image.');
        const info = await imageInfo(blob);
        setResult({ blob, info, fileName: `flixo-ai-${info.width}x${info.height}.png` });
        return;
      }

      if (!file) throw new Error('Choose an image first.');
      let blob: Blob;
      let fileName = baseName(file.name);
      let info: Result['info'];

      if (toolId === 'background-remover') {
        blob = await removeBackground(file, Number(tolerance) || 42);
        fileName += '-no-background.png';
      } else if (toolId === 'image-upscaler') {
        const factor = Number(scale);
        if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) throw new Error('Scale must be between 0.25 and 4.');
        blob = await resizeImage(file, factor);
        fileName += `-upscaled-${factor}x.png`;
      } else if (toolId === 'image-converter') {
        blob = await convertImage(file, outputFormat);
        fileName += outputFormat === 'image/jpeg' ? '.jpg' : outputFormat === 'image/png' ? '.png' : '.webp';
      } else if (toolId === 'image-to-text') {
        const prepared = await preprocessForOcr(file);
        const ocr = await recognizeWithOcrWorker(prepared, 'eng+ara');
        const text = ocr.text;
        setResult({ blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), text, fileName: `${baseName(file.name)}.txt` });
        return;
      } else if (toolId === 'object-remover') {
        blob = await fillRemoveRegion(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) });
        fileName += '-object-removed.png';
      } else if (toolId === 'watermark-remover') {
        blob = await watermarkRemove(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) });
        fileName += '-watermark-removed.png';
      } else if (toolId === 'crop-resize') {
        blob = await cropResizeImage(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }, { width: Number(outW), height: Number(outH) });
        info = await imageInfo(blob);
        assertImageCropperOutputIntegrity(blob, info);
        fileName += '-cropped.png';
      } else {
        blob = await rasterToSvg(file, Number(columns) || 48);
        fileName += '.svg';
      }

      if (blob.type.startsWith('image/') && !info) info = await imageInfo(blob);
      setResult({ blob, info, fileName });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tool failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="image-tool-shell">
      <div className="image-tool-container">
        <header className="image-tool-header">
          <div>
            <p className="image-tool-eyebrow">FLIXO · IMAGE TOOLS</p>
            <h1>{definition.title}</h1>
            <p className="image-tool-lead">{definition.description}</p>
          </div>
        </header>

        <section className="compressor-grid" aria-label={definition.title}>
          <div className="compressor-card">
            {isGenerator ? (
              <label>
                <span>Prompt</span>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic sunset over Cairo..." rows={6} />
              </label>
            ) : (
              <>
                <label className="upload-zone" htmlFor="image-tool-file">
                  <span className="upload-title">{file ? file.name : 'Choose an image'}</span>
                  <span className="upload-subtitle">{definition.accept.replaceAll('image/', '').toUpperCase() || 'IMAGE INPUT'}</span>
                </label>
                <input id="image-tool-file" className="sr-only" type="file" accept={definition.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </>
            )}

            {toolId === 'image-converter' && (
              <label>
                <span>Output format</span>
                <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)}>
                  <option value="image/webp">WebP</option>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                </select>
              </label>
            )}
            {toolId === 'image-upscaler' && (
              <label>
                <span>Scale</span>
                <input inputMode="decimal" value={scale} onChange={(event) => setScale(event.target.value)} />
              </label>
            )}
            {toolId === 'background-remover' && (
              <label>
                <span>Background tolerance</span>
                <input inputMode="numeric" value={tolerance} onChange={(event) => setTolerance(event.target.value)} />
              </label>
            )}
            {toolId === 'raster-to-svg' && (
              <label>
                <span>SVG columns</span>
                <input inputMode="numeric" value={columns} onChange={(event) => setColumns(event.target.value)} />
              </label>
            )}
            {['object-remover', 'watermark-remover', 'crop-resize'].includes(toolId) && (
              <div className="control-grid">
                {([
                  ['X', cropX, setCropX],
                  ['Y', cropY, setCropY],
                  ['Width', cropW, setCropW],
                  ['Height', cropH, setCropH],
                ] as const).map(([label, value, setter]) => (
                  <label key={label}>
                    <span>{label}</span>
                    <input inputMode="numeric" value={value} onChange={(event) => setter(event.target.value)} />
                  </label>
                ))}
                {toolId === 'crop-resize' && (
                  <>
                    <label><span>Output width</span><input inputMode="numeric" value={outW} onChange={(event) => setOutW(event.target.value)} /></label>
                    <label><span>Output height</span><input inputMode="numeric" value={outH} onChange={(event) => setOutH(event.target.value)} /></label>
                  </>
                )}
              </div>
            )}

            <div className="button-row">
              <button className="primary-button" disabled={busy || (!file && !isGenerator)} onClick={() => void run()}>
                {busy ? 'Processing…' : isGenerator ? 'Generate image' : 'Run tool'}
              </button>
            </div>
            {error && <p role="alert" className="error-box">{error}</p>}
            {toolId === 'image-to-text' && <p className="privacy-note">OCR preprocesses the selected image locally, then runs Tesseract.js recognition in a dedicated Web Worker.</p>}
            {isGenerator && <p className="privacy-note">Requires a configured FLIXO image-generation endpoint. No fake local “AI” fallback is used.</p>}
          </div>

          <aside className="result-card" aria-live="polite">
            <p className="image-tool-eyebrow">RESULT</p>
            {result ? (
              <>
                {result.text !== undefined ? <pre style={{ whiteSpace: 'pre-wrap' }}>{result.text || 'No text detected.'}</pre> : previewUrl && <img src={previewUrl} alt="Tool result" style={{ maxWidth: '100%', borderRadius: 12 }} />}
                {result.info && <p className="privacy-note">Output: {result.info.width} × {result.info.height}px · {Math.round(result.blob.size / 1024)} KB · {result.blob.type || 'application/octet-stream'}</p>}
                <div className="button-row">
                  <a className="primary-button" href={downloadUrl} download={result.fileName}>Download {result.fileName}</a>
                  <button className="primary-button" type="button" onClick={() => downloadBlob(result.blob, result.fileName)}>Download now</button>
                </div>
              </>
            ) : <p>No result yet.</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}
