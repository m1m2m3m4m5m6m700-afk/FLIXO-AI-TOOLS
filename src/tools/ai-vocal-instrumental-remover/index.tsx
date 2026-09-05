import { useEffect, useMemo, useRef, useState } from 'react';
import { encodeWav, mixInstrumental, validateDuration, type SeparationBackend, type SeparationResult } from './engine';

type Stem = 'vocals' | 'instrumental';

export function AiVocalInstrumentalRemoverTool() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [backend, setBackend] = useState<SeparationBackend>('webgpu');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose an audio file.');
  const [stems, setStems] = useState<Partial<Record<Stem, Blob>>>({});
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const audioContextOptions = useMemo(() => ({ sampleRate: 44100 }), []);

  const handleFile = async (nextFile: File) => {
    if (!nextFile.type.startsWith('audio/')) {
      setStatus('Please choose an audio file.');
      return;
    }
    const context = new AudioContext(audioContextOptions);
    try {
      const buffer = await context.decodeAudioData(await nextFile.arrayBuffer());
      validateDuration(buffer.duration);
      setFile(nextFile);
      setDuration(buffer.duration);
      setStems({});
      setStatus(`Ready: ${nextFile.name}`);
    } catch (error) {
      setFile(null);
      setDuration(0);
      setStatus(error instanceof Error ? error.message : 'Unable to decode this audio file.');
    } finally {
      await context.close();
    }
  };

  const start = async () => {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setStems({});
    const context = new AudioContext(audioContextOptions);
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const jobId = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<{ type: string; jobId: string; data?: { phase: string; progress: number }; result?: SeparationResult; message?: string }>) => {
      if (event.data.jobId !== jobId) return;
      if (event.data.type === 'progress' && event.data.data) {
        setStatus(event.data.data.phase);
        setProgress(Math.round(event.data.data.progress * 100));
      }
      if (event.data.type === 'done' && event.data.result) {
        const result = event.data.result;
        const vocals = new Blob([encodeWav(result.vocals)], { type: 'audio/wav' });
        const instrumental = new Blob([encodeWav(mixInstrumental(result))], { type: 'audio/wav' });
        setStems({ vocals, instrumental });
        setProgress(100);
        setStatus('Separation complete.');
        setBusy(false);
        worker.terminate();
        void context.close();
      }
      if (event.data.type === 'error') {
        setStatus(event.data.message ?? 'Local AI separation failed.');
        setBusy(false);
        worker.terminate();
        void context.close();
      }
    };

    try {
      const audio = await context.decodeAudioData(await file.arrayBuffer());
      const left = audio.getChannelData(0).slice();
      const right = audio.numberOfChannels > 1 ? audio.getChannelData(1).slice() : left.slice();
      const effectiveBackend: SeparationBackend = backend === 'webgpu' && !('gpu' in navigator) ? 'wasm' : backend;
      if (effectiveBackend !== backend) setStatus('WebGPU is unavailable; using WASM CPU fallback.');
      worker.postMessage({ jobId, left, right, backend: effectiveBackend }, [left.buffer, right.buffer]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to prepare audio.');
      setBusy(false);
      worker.terminate();
      await context.close();
    }
  };

  const download = (kind: Stem) => {
    const blob = stems[kind];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'audio'}-${kind}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
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
