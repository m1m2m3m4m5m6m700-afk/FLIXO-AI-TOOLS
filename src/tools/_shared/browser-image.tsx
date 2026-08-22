import { useMemo, useState } from 'react';
import { recordToolPerformance } from '../../lib/diagnostics/performance';

type Mode = 'photo-colorizer' | 'background-blur' | 'passport-photo-maker' | 'watermark-adder' | 'meme-generator' | 'collage-maker' | 'image-effects' | 'exif-cleaner' | 'svg-optimizer' | 'mockup-generator' | 'image-to-svg';

type Props = { mode: Mode; title: string; accept?: string; multi?: boolean };

type Result = { blob: Blob; url: string; name: string; width?: number; height?: number; text?: string };

type EffectsWorkerResponse = { ok: boolean; blob?: Blob; error?: string };

function download(result: Result) {
  const link = document.createElement('a');
  link.href = result.url;
  link.download = result.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(result.url), 0);
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasResult(canvas: HTMLCanvasElement, name: string, mime = 'image/png', quality = 0.96): Promise<Result> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode output.')), mime, quality));
  return { blob, url: URL.createObjectURL(blob), name, width: canvas.width, height: canvas.height };
}

async function runImageEffectsWorker(blob: Blob, effect: { brightness: number; contrast: number; saturate: number; grayscale: number }, width: number, height: number): Promise<Result> {
  if (typeof Worker === 'undefined') throw new Error('Image Effects Worker is unavailable.');
  const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
  return await new Promise<Result>((resolve, reject) => {
    const worker = new Worker(new URL('./image-effects-worker.ts', import.meta.url), { type: 'classic' });
    const cleanup = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<EffectsWorkerResponse>) => {
      const workerDurationMs = Math.max(0, (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt);
      cleanup();
      if (event.data.ok && event.data.blob instanceof Blob) {
        const output = event.data.blob;
        recordToolPerformance({
          toolId: 'image-effects',
          operation: 'worker-transform',
          durationMs: workerDurationMs,
          workerDurationMs,
          encodeDurationMs: workerDurationMs,
        });
        resolve({ blob: output, url: URL.createObjectURL(output), name: 'flixo-image-effects.png', width, height });
      } else {
        reject(new Error(event.data.error || 'Image Effects Worker failed.'));
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Image Effects Worker could not start.'));
    };
    worker.postMessage({ blob, width, height, ...effect });
  });
}

export function BrowserImageTool({ mode, title, accept = 'image/*', multi = false }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('FLIXO');
  const [top, setTop] = useState('TOP TEXT');
  const [bottom, setBottom] = useState('BOTTOM TEXT');
  const [effect, setEffect] = useState({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0 });

  const status = useMemo(() => result ? `${result.width ?? ''}×${result.height ?? ''} · ${Math.max(1, Math.round(result.blob.size / 1024))} KB` : 'No result yet.', [result]);

  async function run() {
    if (!files.length) { setError('Choose an image first.'); return; }
    setError(''); setBusy(true); setResult(null);
    try {
      if (mode === 'svg-optimizer') {
        const svg = await files[0].text();
        const optimized = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
        const blob = new Blob([optimized], { type: 'image/svg+xml' });
        setResult({ blob, url: URL.createObjectURL(blob), name: 'flixo-optimized.svg', text: optimized });
        return;
      }

      if (mode === 'photo-colorizer') {
        const endpoint = import.meta.env.VITE_PHOTO_COLORIZER_ENDPOINT;
        if (!endpoint) throw new Error('Photo Colorizer requires VITE_PHOTO_COLORIZER_ENDPOINT; no fake AI fallback is used.');
        const body = new FormData(); body.append('image', files[0]);
        const response = await fetch(endpoint, { method: 'POST', body });
        if (!response.ok) throw new Error(`Colorizer request failed (${response.status}).`);
        const blob = await response.blob();
        setResult({ blob, url: URL.createObjectURL(blob), name: 'flixo-colorized.png' });
        return;
      }

      if (mode === 'collage-maker') {
        const images = await Promise.all(files.map(loadImage));
        const cell = 512; const columns = Math.min(3, Math.ceil(Math.sqrt(images.length))); const rows = Math.ceil(images.length / columns);
        const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * cell;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable.');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        images.forEach((image, index) => { const x = (index % columns) * cell; const y = Math.floor(index / columns) * cell; const scale = Math.min(cell / image.width, cell / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, x + (cell - w) / 2, y + (cell - h) / 2, w, h); });
        setResult(await canvasResult(canvas, 'flixo-collage.png')); return;
      }

      const image = await loadImage(files[0]);
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable.');
      let width = image.width; let height = image.height;
      if (mode === 'passport-photo-maker') { width = 413; height = 531; }
      canvas.width = width; canvas.height = height;

      if (mode === 'image-to-svg') {
        const png = document.createElement('canvas'); png.width = image.width; png.height = image.height; const pctx = png.getContext('2d'); if (!pctx) throw new Error('Canvas unavailable.'); pctx.drawImage(image, 0, 0);
        const data = png.toDataURL('image/png');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}"><image href="${data}" width="${image.width}" height="${image.height}"/></svg>`;
        const blob = new Blob([svg], { type: 'image/svg+xml' }); setResult({ blob, url: URL.createObjectURL(blob), name: 'flixo-image.svg', width: image.width, height: image.height, text: svg }); return;
      }

      if (mode === 'mockup-generator') {
        ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#1f2937'; ctx.roundRect(18, 18, width - 36, height - 36, 42); ctx.fill();
        ctx.drawImage(image, 42, 72, width - 84, height - 114); ctx.fillStyle = '#000'; ctx.fillRect(width / 2 - 24, 30, 48, 8);
      } else if (mode === 'passport-photo-maker') {
        const scale = Math.max(width / image.width, height / image.height); const w = image.width * scale; const h = image.height * scale; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      } else if (mode === 'background-blur') {
        ctx.filter = 'blur(16px)'; ctx.drawImage(image, 0, 0, width, height); ctx.filter = 'none'; const inset = Math.round(Math.min(width, height) * 0.18); ctx.drawImage(image, inset, inset, width - inset * 2, height - inset * 2);
      } else if (mode === 'watermark-adder') {
        ctx.drawImage(image, 0, 0, width, height); ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(24, Math.round(width / 18))}px sans-serif`; ctx.textAlign = 'right'; ctx.rotate(-Math.PI / 12); ctx.fillText(text, width - 30, height / 2); ctx.restore();
      } else if (mode === 'meme-generator') {
        ctx.drawImage(image, 0, 0, width, height); ctx.font = `900 ${Math.max(32, Math.round(width / 10))}px Impact, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff'; ctx.strokeText(top, width / 2, 60); ctx.fillText(top, width / 2, 60); ctx.strokeText(bottom, width / 2, height - 30); ctx.fillText(bottom, width / 2, height - 30);
      } else if (mode === 'image-effects') {
        const baseBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not prepare image.')), 'image/png'));
        setResult(await runImageEffectsWorker(baseBlob, effect, width, height));
        return;
      } else if (mode === 'exif-cleaner') {
        ctx.drawImage(image, 0, 0, width, height);
      } else {
        ctx.drawImage(image, 0, 0, width, height);
      }
      setResult(await canvasResult(canvas, `flixo-${mode}.png`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operation failed.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl px-6 py-10">
    <h1 className="text-3xl font-bold">{title}</h1>
    <p className="mt-2 text-sm opacity-70">Client-side processing. Your file stays in the browser unless this tool explicitly requires a configured AI endpoint.</p>
    <input className="mt-6 block w-full" type="file" accept={accept} multiple={multi} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
    {(mode === 'watermark-adder') && <input className="mt-4 w-full rounded border p-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Watermark text" />}
    {(mode === 'meme-generator') && <div className="mt-4 grid gap-2"><input className="rounded border p-2" value={top} onChange={(e) => setTop(e.target.value)} /><input className="rounded border p-2" value={bottom} onChange={(e) => setBottom(e.target.value)} /></div>}
    {(mode === 'image-effects') && <div className="mt-4 grid gap-2 sm:grid-cols-2"><label>Brightness <input type="range" min="50" max="150" value={effect.brightness} onChange={(e) => setEffect({ ...effect, brightness: Number(e.target.value) })} /></label><label>Contrast <input type="range" min="50" max="150" value={effect.contrast} onChange={(e) => setEffect({ ...effect, contrast: Number(e.target.value) })} /></label><label>Saturation <input type="range" min="0" max="200" value={effect.saturate} onChange={(e) => setEffect({ ...effect, saturate: Number(e.target.value) })} /></label><label>Grayscale <input type="range" min="0" max="100" value={effect.grayscale} onChange={(e) => setEffect({ ...effect, grayscale: Number(e.target.value) })} /></label></div>}
    <button className="mt-6 rounded bg-black px-5 py-3 text-white" type="button" disabled={busy} onClick={run}>{busy ? 'Processing…' : 'Run tool'}</button>
    {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
    {result && <section className="mt-8 rounded-xl border p-4"><div className="mb-3 font-semibold">RESULT</div>{result.text ? <pre className="max-h-72 overflow-auto text-xs">{result.text}</pre> : <img className="max-h-[28rem] w-full object-contain" src={result.url} alt="Tool result" />}{!result.text && <p className="mt-2 text-sm opacity-70">{status}</p>}<button className="mt-4 rounded border px-4 py-2" type="button" onClick={() => download(result)}>Download now</button></section>}
  </main>;
}
