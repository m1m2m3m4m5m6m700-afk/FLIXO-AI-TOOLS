import { useEffect, useMemo, useRef, useState } from 'react';
import { encodeWav, mixInstrumental, validateDuration, type SeparationBackend, type SeparationResult } from './engine';
import { useDisposableResourceOwner, throwIfAborted } from '@/lib/resources/disposable-resource-owner';

type Stem = 'vocals' | 'instrumental';

export function AiVocalInstrumentalRemoverTool() {
  const resources = useDisposableResourceOwner();
  const processingControllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [backend, setBackend] = useState<SeparationBackend>('webgpu');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose an audio file.');
  const [stems, setStems] = useState<Partial<Record<Stem, Blob>>>({});

  useEffect(() => () => {
    processingControllerRef.current?.abort();
    void resources.disposeAll();
  }, [resources]);

  const audioContextOptions = useMemo(() => ({ sampleRate: 44100 }), []);

  const handleFile = async (nextFile: File) => {
    if (!nextFile.type.startsWith('audio/')) {
      setStatus('Please choose an audio file.');
      return;
    }
    processingControllerRef.current?.abort();
    processingControllerRef.current = null;
    await resources.dispose('ai-vocal-context');
    const controller = new AbortController();
    processingControllerRef.current = controller;
    try {
      const context = resources.audioContext('ai-vocal-context', new AudioContext(audioContextOptions));
      const buffer = await context.decodeAudioData(await nextFile.arrayBuffer());
      throwIfAborted(controller.signal);
      validateDuration(buffer.duration);
      setFile(nextFile);
      setDuration(buffer.duration);
      setStems({});
      setStatus(`Ready: ${nextFile.name}`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFile(null);
        setDuration(0);
        setStatus(error instanceof Error ? error.message : 'Unable to decode this audio file.');
      }
    } finally {
      try {
        await resources.dispose('ai-vocal-context');
      } finally {
        if (processingControllerRef.current === controller) processingControllerRef.current = null;
      }
    }
  };

  const start = async () => {
    if (!file || busy) return;
    processingControllerRef.current?.abort();
    const controller = new AbortController();
    const jobId = crypto.randomUUID();
    processingControllerRef.current = controller;
    jobIdRef.current = jobId;
    setBusy(true);
    setProgress(0);
    setStems({});
    try {
      const context = resources.audioContext('ai-vocal-context', new AudioContext(audioContextOptions));
      const audio = await context.decodeAudioData(await file.arrayBuffer());
      throwIfAborted(controller.signal);
      const effectiveBackend: SeparationBackend = backend === 'webgpu' && !('gpu' in navigator) ? 'wasm' : backend;
      if (effectiveBackend !== backend) setStatus('WebGPU is unavailable; using WASM CPU fallback.');
      const worker = resources.worker('ai-vocal-worker', new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new DOMException('The operation was aborted.', 'AbortError'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        worker.onmessage = (event: MessageEvent<{ type: string; jobId: string; data?: { phase: string; progress: number }; result?: SeparationResult; message?: string }>) => {
          if (controller.signal.aborted || event.data.jobId !== jobId || jobIdRef.current !== jobId) return;
          if (event.data.type === 'progress' && event.data.data) {
            setStatus(event.data.data.phase);
            setProgress(Math.round(event.data.data.progress * 100));
            return;
          }
          controller.signal.removeEventListener('abort', onAbort);
          if (event.data.type === 'error') {
            reject(new Error(event.data.message ?? 'Local AI separation failed.'));
            return;
          }
          if (event.data.type === 'done' && event.data.result) {
            const result = event.data.result;
            setStems({ vocals: new Blob([encodeWav(result.vocals)], { type: 'audio/wav' }), instrumental: new Blob([encodeWav(mixInstrumental(result))], { type: 'audio/wav' }) });
            setProgress(100);
            setStatus('Separation complete.');
            resolve();
          }
        };
        worker.onerror = () => {
          controller.signal.removeEventListener('abort', onAbort);
          reject(new Error('Local AI separation worker failed.'));
        };
      });
    } catch (error) {
      if (!controller.signal.aborted && jobIdRef.current === jobId) setStatus(error instanceof Error ? error.message : 'Unable to prepare audio.');
    } finally {
      try {
        await resources.dispose('ai-vocal-worker');
      } finally {
        await resources.dispose('ai-vocal-context');
        if (jobIdRef.current === jobId) {
          jobIdRef.current = null;
          processingControllerRef.current = null;
          setBusy(false);
        }
      }
    }
  };

  const download = (kind: Stem) => {
    const blob = stems[kind];
    if (!blob) return;
    const url = resources.objectUrl(`ai-vocal-download-${kind}`, blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'audio'}-${kind}.wav`;
    anchor.click();
    void resources.dispose(`ai-vocal-download-${kind}`);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Vocal & Instrumental Remover</h1>
        <p className="mt-2 text-sm opacity-75">Local Demucs separation. The model downloads on first use and stays out of the initial bundle.</p>
      </div>
      <input aria-label="Audio file" type="file" accept="audio/*" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void handleFile(selected); }} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-3 text-sm">Duration: {duration ? `${duration.toFixed(1)}s` : '—'}</div>
        <label className="rounded-xl border p-3 text-sm">Backend
          <select value={backend} onChange={(event) => setBackend(event.target.value as SeparationBackend)} disabled={busy} className="ml-2 rounded border p-1">
            <option value="webgpu">WebGPU</option>
            <option value="wasm">WASM CPU</option>
          </select>
        </label>
        <div className="rounded-xl border p-3 text-sm">Model: ~170 MB first download</div>
      </div>
      <button type="button" onClick={() => void start()} disabled={!file || busy} className="rounded-xl border px-4 py-2 disabled:opacity-50">
        {busy ? `Separating… ${progress}%` : 'Separate vocals / instrumental'}
      </button>
      <div role="status" aria-live="polite" className="text-sm opacity-80">{status}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={!stems.vocals} onClick={() => download('vocals')} className="rounded-xl border p-4 disabled:opacity-50">Download Vocals</button>
        <button type="button" disabled={!stems.instrumental} onClick={() => download('instrumental')} className="rounded-xl border p-4 disabled:opacity-50">Download Instrumental</button>
      </div>
    </section>
  );
}
