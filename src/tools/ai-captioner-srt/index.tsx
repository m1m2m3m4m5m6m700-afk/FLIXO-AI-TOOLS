import { useEffect, useRef, useState } from 'react';
import { clampCaptionDuration, makeCaptionFilename, normalizeSegments, segmentsToSrt, segmentsToVtt, type CaptionSegment } from './engine';

type WorkerMessage =
  | { type: 'status'; jobId: string; message: string }
  | { type: 'done'; jobId: string; result: { text?: string; chunks?: unknown[] } }
  | { type: 'error'; jobId: string; message: string };

export function AiCaptionerSrtTool() {
  const workerRef = useRef<Worker | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [device, setDevice] = useState<'webgpu' | 'wasm'>('webgpu');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => workerRef.current?.terminate(), []);

  const choose = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('video/') && !next.type.startsWith('audio/')) {
      setError('Please choose a video or audio file.');
      return;
    }
    setFile(next);
    setSegments([]);
    setError('');
    setStatus(`${(next.size / 1024 / 1024).toFixed(2)} MB selected`);
  };

  const transcribe = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setSegments([]);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const jobId = crypto.randomUUID();

    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (data.jobId !== jobId) return;
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
      const nextSegments = normalizeSegments(data.result.chunks);
      setSegments(nextSegments);
      setBusy(false);
      setStatus(nextSegments.length ? `${nextSegments.length} caption segments generated.` : data.result.text || 'No timestamped segments were returned.');
      worker.terminate();
    };

    worker.onerror = () => {
      setBusy(false);
      setError('Caption worker failed.');
      setStatus('');
      worker.terminate();
    };

    try {
      const buffer = await file.arrayBuffer();
      const maxSeconds = clampCaptionDuration(600);
      if (maxSeconds <= 0) throw new Error('Invalid local transcription limit.');
      worker.postMessage({ jobId, file: buffer, device }, [buffer]);
    } catch {
      setBusy(false);
      setError('Unable to read the selected file.');
      worker.terminate();
    }
  };

  const srt = segmentsToSrt(segments);
  const vtt = segmentsToVtt(segments);
  const text = segments.map((segment) => segment.text).join(' ');

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
      <div>
        <h1 className="text-2xl font-bold">AI Auto-Captioner & SRT Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">Transcribe short media locally with Whisper and generate timestamped SRT/VTT captions.</p>
      </div>
      <label className="rounded-xl border border-dashed border-border p-6 text-center">
        <span className="mb-3 block font-medium">Choose video or audio</span>
        <input aria-label="Media file" type="file" accept="video/*,audio/*" onChange={(event) => choose(event.target.files?.[0])} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Inference device<select aria-label="Inference device" className="mt-1 w-full rounded border p-2" value={device} onChange={(event) => setDevice(event.target.value === 'wasm' ? 'wasm' : 'webgpu')}><option value="webgpu">WebGPU</option><option value="wasm">WASM CPU</option></select></label>
        {file ? <p className="self-end text-sm text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · max 10 min</p> : null}
      </div>
      <button type="button" disabled={!file || busy} onClick={() => void transcribe()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Generating captions…' : 'Generate captions'}</button>
      {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {segments.length ? <>
        <textarea aria-label="Transcript" readOnly className="min-h-40 rounded-xl border p-3" value={text} />
        <div className="grid gap-3 md:grid-cols-2">
          <a className="rounded-xl border px-4 py-3 text-center font-semibold" download={file ? makeCaptionFilename(file.name, 'srt') : 'flixo-caption.srt'} href={`data:text/plain;charset=utf-8,${encodeURIComponent(srt)}`}>Download SRT</a>
          <a className="rounded-xl border px-4 py-3 text-center font-semibold" download={file ? makeCaptionFilename(file.name, 'vtt') : 'flixo-caption.vtt'} href={`data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`}>Download VTT</a>
        </div>
      </> : null}
    </section>
  );
}
