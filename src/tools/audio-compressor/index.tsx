import { useEffect, useRef, useState } from 'react';
import { calculateSavings, getOutputName, normalizeQuality, type CompressionQuality } from './engine';
import { useDisposableResourceOwner } from '@/lib/resources/disposable-resource-owner';

type WorkerMessage =
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'done'; jobId: string; bytes: ArrayBuffer }
  | { type: 'error'; jobId: string; message: string };

export function AudioCompressorTool() {
  const resources = useDisposableResourceOwner();
  const processingControllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<CompressionQuality>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);

  useEffect(() => () => {
    processingControllerRef.current?.abort();
    void resources.disposeAll();
  }, [resources]);

  const chooseFile = (next?: File) => {
    if (!next) return;
    processingControllerRef.current?.abort();
    processingControllerRef.current = null;
    void resources.dispose('audio-compressor-output');
    void resources.dispose('audio-compressor-worker');
    void resources.dispose('audio-compressor-context');
    if (!next.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    setFile(next);
    setError('');
    setOutputSize(null);
    setOutputUrl(null);
  };

  const compress = async () => {
    if (!file || busy) return;
    processingControllerRef.current?.abort();
    const controller = new AbortController();
    const jobId = crypto.randomUUID();
    processingControllerRef.current = controller;
    jobIdRef.current = jobId;
    setBusy(true); setError(''); setProgress(0);

    try {
      const audioContext = resources.audioContext('audio-compressor-context', new AudioContext());
      const worker = resources.worker('audio-compressor-worker', new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
      if (controller.signal.aborted || jobIdRef.current !== jobId) return;
      const samples = decoded.getChannelData(0).slice();
      const buffer = samples.buffer;

      const done = new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new DOMException('The operation was aborted.', 'AbortError'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
          if (controller.signal.aborted || data.jobId !== jobId || jobIdRef.current !== jobId) return;
          if (data.type === 'progress') { setProgress(Math.round(data.progress * 100)); return; }
          controller.signal.removeEventListener('abort', onAbort);
          if (data.type === 'error') { reject(new Error(data.message)); return; }
          const nextUrl = resources.objectUrl('audio-compressor-output', new Blob([data.bytes], { type: 'audio/wav' }));
          setOutputUrl(nextUrl); setOutputSize(data.bytes.byteLength); setProgress(100); resolve();
        };
        worker.onerror = () => {
          controller.signal.removeEventListener('abort', onAbort);
          reject(new Error('Audio processing worker failed.'));
        };
      });

      worker.postMessage({ jobId, samples, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels, quality: normalizeQuality(quality) }, [buffer]);
      await done;
    } catch (cause) {
      if (!controller.signal.aborted && jobIdRef.current === jobId) setError(cause instanceof Error ? cause.message : 'Unable to process the selected audio.');
    } finally {
      try {
        await resources.dispose('audio-compressor-worker');
      } finally {
        await resources.dispose('audio-compressor-context');
        if (jobIdRef.current === jobId) {
          jobIdRef.current = null;
          processingControllerRef.current = null;
          setBusy(false);
        }
      }
    }
  };

  return <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
    <div><h1 className="text-2xl font-bold">Audio Compressor</h1><p className="mt-1 text-sm text-muted-foreground">Reduce decoded audio size locally with a background worker.</p></div>
    <label className="rounded-xl border border-dashed border-border p-6 text-center"><span className="mb-3 block font-medium">Choose audio</span><input aria-label="Audio file" type="file" accept="audio/*" onChange={(e) => chooseFile(e.target.files?.[0])} /></label>
    <label>Quality<select aria-label="Compression quality" className="mt-1 w-full rounded border p-2" value={quality} onChange={(e) => setQuality(normalizeQuality(e.target.value))}><option value="high">High</option><option value="balanced">Balanced</option><option value="small">Small</option></select></label>
    {file ? <p className="text-sm text-muted-foreground">Input: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}
    <button type="button" disabled={!file || busy} onClick={() => void compress()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Compressing…' : 'Compress Audio'}</button>
    {busy ? <progress aria-label="Compression progress" className="w-full" max={100} value={progress} /> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {outputUrl ? <p className="text-sm text-muted-foreground">Size change: {calculateSavings(file?.size ?? 0, outputSize ?? 0).toFixed(1)}%</p> : null}
    {outputUrl ? <a className="rounded-xl border border-border px-4 py-3 text-center font-semibold" href={outputUrl} download={file ? getOutputName(file.name) : 'flixo-compressed.wav'}>Download compressed WAV · {((outputSize ?? 0) / 1024 / 1024).toFixed(2)} MB</a> : null}
  </section>;
}
