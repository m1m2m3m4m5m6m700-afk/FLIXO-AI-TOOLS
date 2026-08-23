import { useState } from 'react';
import GIF from 'gif.js';
import workerUrl from 'gif.js/dist/gif.worker.js?url';
import { clampGifRange, drawMemeText, normalizeFps, normalizeWidth } from './engine';

async function metadata(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const value = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(url);
      if (value.duration) {
        resolve(value);
      } else {
        reject(new Error('Unable to read video metadata'));
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load video'));
    };
    video.src = url;
  });
}

export function VideoGifMemeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fps, setFps] = useState(8);
  const [width, setWidth] = useState(480);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const choose = async (next?: File) => {
    if (!next) {
      return;
    }
    if (!next.type.startsWith('video/')) {
      setError('Please choose a video file.');
      return;
    }

    setError('');
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }
    setOutputUrl(null);

    try {
      const m = await metadata(next);
      setFile(next);
      setDuration(m.duration);
      setStart(0);
      setEnd(Math.min(5, m.duration));
      setWidth(Math.min(720, Math.max(160, m.width)));
      setStatus(`${m.width}×${m.height} · ${m.duration.toFixed(2)}s`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read video');
    }
  };

  const generate = async () => {
    if (!file) {
      return;
    }

    const range = clampGifRange(start, end, duration);
    const safeFps = normalizeFps(fps);
    const safeWidth = normalizeWidth(width);
    const seconds = range.end - range.start;

    if (seconds <= 0 || seconds > 12) {
      setError('GIF duration must be between 0 and 12 seconds.');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('Rendering GIF…');

    const video = document.createElement('video');
    const sourceUrl = URL.createObjectURL(file);
    video.src = sourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Unable to load video'));
      });

      const ratio = video.videoHeight ? video.videoWidth / video.videoHeight : 1;
      const height = Math.max(1, Math.round(safeWidth / ratio));
      const canvas = document.createElement('canvas');
      canvas.width = safeWidth;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas is unavailable');
      }

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: canvas.width,
        height: canvas.height,
        workerScript: workerUrl,
      });
      const frameCount = Math.min(180, Math.ceil(seconds * safeFps));

      for (let i = 0; i < frameCount; i += 1) {
        video.currentTime = range.start + (seconds * i) / Math.max(1, frameCount - 1);
        await new Promise<void>((resolve) => {
          video.addEventListener('seeked', () => resolve(), { once: true });
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawMemeText(ctx, topText, canvas.width / 2, 12, canvas.width - 24);
        drawMemeText(ctx, bottomText, canvas.width / 2, Math.max(12, canvas.height - 72), canvas.width - 24);
        gif.addFrame(canvas, { copy: true, delay: Math.round(1000 / safeFps) });
        setStatus(`Rendering GIF… ${i + 1}/${frameCount}`);
      }

      gif.on('finished', (blob: Blob) => {
        setOutputUrl(URL.createObjectURL(blob));
        setStatus(`GIF ready · ${(blob.size / 1024).toFixed(1)} KB`);
        setBusy(false);
        URL.revokeObjectURL(sourceUrl);
      });
      gif.on('abort', () => {
        setError('GIF rendering was aborted.');
        setBusy(false);
        URL.revokeObjectURL(sourceUrl);
      });
      gif.render();
    } catch (e) {
      setBusy(false);
      URL.revokeObjectURL(sourceUrl);
      setError(e instanceof Error ? e.message : 'Unable to render GIF');
    }
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
      <div>
        <h1 className="text-2xl font-bold">Video to GIF & Meme Maker</h1>
        <p className="mt-1 text-sm text-muted-foreground">Convert a short video clip to GIF and add top/bottom meme text locally.</p>
      </div>
      <label className="rounded-xl border border-dashed border-border p-6 text-center">
        <span className="mb-3 block font-medium">Choose video</span>
        <input aria-label="Video file" type="file" accept="video/*" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>
      {file ? (
        <>
          <video className="max-h-80 w-full rounded-xl bg-black" src={URL.createObjectURL(file)} controls muted />
          <div className="grid gap-4 md:grid-cols-2">
            <label>Start<input className="mt-1 w-full rounded border p-2" type="number" min={0} max={duration} step={0.1} value={start} onChange={(e) => setStart(Number(e.target.value))} /></label>
            <label>End<input className="mt-1 w-full rounded border p-2" type="number" min={0} max={duration} step={0.1} value={end} onChange={(e) => setEnd(Number(e.target.value))} /></label>
            <label>FPS<input className="mt-1 w-full rounded border p-2" type="number" min={2} max={15} value={fps} onChange={(e) => setFps(Number(e.target.value))} /></label>
            <label>Width<input className="mt-1 w-full rounded border p-2" type="number" min={160} max={720} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
            <label>Top text<input className="mt-1 w-full rounded border p-2" value={topText} onChange={(e) => setTopText(e.target.value)} /></label>
            <label>Bottom text<input className="mt-1 w-full rounded border p-2" value={bottomText} onChange={(e) => setBottomText(e.target.value)} /></label>
          </div>
          <button type="button" disabled={busy} onClick={() => void generate()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? 'Rendering…' : 'Create GIF'}
          </button>
        </>
      ) : null}
      {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {outputUrl ? <a className="rounded-xl border border-border px-4 py-3 text-center font-semibold" href={outputUrl} download="flixo-meme.gif">Download GIF</a> : null}
    </section>
  );
}
