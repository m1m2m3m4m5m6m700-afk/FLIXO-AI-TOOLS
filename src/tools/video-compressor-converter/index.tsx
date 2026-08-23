import { useEffect, useRef, useState } from 'react';
import { buildFfmpegArguments, calculateSavings, getOutputMimeType, makeOutputFilename, normalizeVideoFormat, normalizeVideoQuality, type VideoOutputFormat, type VideoQuality } from './engine';

type WorkerMessage =
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'status'; jobId: string; message: string }
  | { type: 'done'; jobId: string; bytes: Uint8Array }
  | { type: 'error'; jobId: string; message: string };

export function VideoCompressorConverterTool() {
  const workerRef = useRef<Worker | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<VideoOutputFormat>('mp4');
  const [quality, setQuality] = useState<VideoQuality>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const choose = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('video/')) {
      setError('Please choose a video file.');
      return;
    }
    setFile(next);
    setError('');
    setOutputSize(null);
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = null;
    setOutputUrl(null);
    setStatus(`${(next.size / 1024 / 1024).toFixed(2)} MB selected`);
  };

  const run = () => {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setError('');
    setOutputSize(null);
    setStatus('Preparing local worker…');

    workerRef.current?.terminate();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const jobId = crypto.randomUUID();
    const inputName = `input-${jobId}.${file.name.split('.').pop() || 'mp4'}`;
    const outputName = `output-${jobId}.${format}`;
    const args = buildFfmpegArguments(inputName, outputName, normalizeVideoFormat(format), normalizeVideoQuality(quality));

    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (data.jobId !== jobId) return;
      if (data.type === 'progress') {
        setProgress(Math.round(data.progress * 100));
        setStatus(`Processing… ${Math.round(data.progress * 100)}%`);
        return;
      }
      if (data.type === 'status') {
        setStatus(data.message);
        return;
      }
      if (data.type === 'error') {
        setBusy(false);
        setError(data.message);
        setStatus('');
        worker.terminate();
        return;
      }
      const blob = new Blob([data.bytes], { type: getOutputMimeType(format) });
      const url = URL.createObjectURL(blob);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = url;
      setOutputUrl(url);
      setOutputSize(blob.size);
      setProgress(100);
      setBusy(false);
      setStatus(`Ready · ${calculateSavings(file.size, blob.size).toFixed(1)}% size reduction`);
      worker.terminate();
    };

    worker.onerror = () => {
      setBusy(false);
      setError('Video processing worker failed.');
      setStatus('');
      worker.terminate();
    };

    void file.arrayBuffer().then((buffer) => {
      worker.postMessage({ jobId, file: new Uint8Array(buffer), inputName, outputName, args }, [buffer]);
    }).catch(() => {
      setBusy(false);
      setError('Unable to read the selected file.');
      worker.terminate();
    });
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
      <div>
        <h1 className="text-2xl font-bold">Video Compressor & Converter</h1>
        <p className="mt-1 text-sm text-muted-foreground">Compress or convert video locally with a background FFmpeg worker.</p>
      </div>
      <label className="rounded-xl border border-dashed border-border p-6 text-center">
        <span className="mb-3 block font-medium">Choose video</span>
        <input aria-label="Video file" type="file" accept="video/*" onChange={(event) => choose(event.target.files?.[0])} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Output format<select aria-label="Output format" className="mt-1 w-full rounded border p-2" value={format} onChange={(e) => setFormat(normalizeVideoFormat(e.target.value))}><option value="mp4">MP4</option><option value="webm">WebM</option><option value="gif">GIF</option></select></label>
        <label>Quality<select aria-label="Quality" className="mt-1 w-full rounded border p-2" value={quality} onChange={(e) => setQuality(normalizeVideoQuality(e.target.value))}><option value="high">High</option><option value="balanced">Balanced</option><option value="small">Small</option></select></label>
      </div>
      {file ? <p className="text-sm text-muted-foreground">Input: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}
      <button type="button" disabled={!file || busy} onClick={run} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Processing…' : 'Compress / Convert'}</button>
      {busy ? <progress aria-label="Processing progress" className="w-full" max={100} value={progress} /> : null}
      {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {outputUrl ? <a className="rounded-xl border border-border px-4 py-3 text-center font-semibold" href={outputUrl} download={file ? makeOutputFilename(file.name, format) : `flixo-video.${format}`}>Download output{outputSize ? ` · ${(outputSize / 1024 / 1024).toFixed(2)} MB` : ''}</a> : null}
    </section>
  );
}
