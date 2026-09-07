import { useEffect, useRef, useState } from 'react';
import { DisposableResourceOwner, throwIfAborted } from '@/lib/resources/disposable-resource-owner';

type WorkerResponse = { channels: Float32Array[] } | { error: string };

function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const frameCount = channels[0]?.length ?? 0;
  const channelCount = channels.length;
  const buffer = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + frameCount * channelCount * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channelCount, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true); view.setUint16(32, channelCount * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frameCount * channelCount * 2, true);
  let offset = 44;
  for (let i = 0; i < frameCount; i += 1) for (let c = 0; c < channelCount; c += 1) {
    const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function AudioNoiseReducerTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resources = new DisposableResourceOwner();
  const ownerRef = useRef(resources);
  const processingControllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reduction, setReduction] = useState(0.65);
  const [status, setStatus] = useState('Ready');
  const [output, setOutput] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    processingControllerRef.current?.abort();
    void ownerRef.current.disposeAll();
  }, []);

  async function process() {
    if (!file || busy) return;
    processingControllerRef.current?.abort();
    const controller = new AbortController();
    const jobId = crypto.randomUUID();
    processingControllerRef.current = controller;
    jobIdRef.current = jobId;
    setBusy(true); setStatus('Decoding audio…'); setOutput(null); setOutputUrl('');
    await ownerRef.current.dispose('noise-reducer-output');
    try {
      const context = ownerRef.current.audioContext('noise-reducer-context', new AudioContext());
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      throwIfAborted(controller.signal);
      const worker = ownerRef.current.worker('noise-reducer-worker', new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      const result = await new Promise<WorkerResponse>((resolve, reject) => {
        const onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new DOMException('The operation was aborted.', 'AbortError'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (controller.signal.aborted || jobIdRef.current !== jobId) return;
          controller.signal.removeEventListener('abort', onAbort);
          resolve(event.data);
        };
        worker.onerror = () => {
          controller.signal.removeEventListener('abort', onAbort);
          reject(new Error('Noise reduction worker failed.'));
        };
      });
      if ('error' in result) throw new Error(result.error);
      throwIfAborted(controller.signal);
      const channels = result.channels;
      const blob = encodeWav(channels, decoded.sampleRate);
      const nextUrl = ownerRef.current.objectUrl('noise-reducer-output', blob);
      setOutput(blob); setOutputUrl(nextUrl); setStatus(`Done • output ${Math.round(blob.size / 1024)} KB`);
    } catch (error) {
      if (!controller.signal.aborted && jobIdRef.current === jobId) setStatus(error instanceof Error ? error.message : 'Noise reduction failed.');
    } finally {
      try {
        await ownerRef.current.dispose('noise-reducer-worker');
      } finally {
        await ownerRef.current.dispose('noise-reducer-context');
        if (jobIdRef.current === jobId) {
          jobIdRef.current = null;
          processingControllerRef.current = null;
          setBusy(false);
        }
      }
    }
  }

  return <section className="mx-auto max-w-3xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">Audio Noise Reducer</h1><p className="text-sm opacity-70">Reduce steady background noise locally in your browser.</p></header>
    <input ref={inputRef} hidden type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    <button className="rounded border px-4 py-2" onClick={() => inputRef.current?.click()}>Choose audio</button>
    {file && <div className="rounded border p-4 text-sm">{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
    <label className="block">Reduction: {Math.round(reduction * 100)}%
      <input className="mt-2 w-full" type="range" min="0" max="100" value={Math.round(reduction * 100)} onChange={(e) => setReduction(Number(e.target.value) / 100)} />
    </label>
    <button disabled={!file || busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" onClick={() => void process()}>{busy ? 'Processing…' : 'Reduce Noise'}</button>
    <p className="text-sm" aria-live="polite">{status}</p>
    {output && outputUrl && <a className="inline-block rounded border px-4 py-2" href={outputUrl} download="flixo-noise-reduced.wav">Download WAV</a>}
  </section>;
}
