import { useMemo, useRef, useState } from 'react';
import { applyNoiseReduction } from './engine';

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
  const [file, setFile] = useState<File | null>(null);
  const [reduction, setReduction] = useState(0.65);
  const [status, setStatus] = useState('Ready');
  const [output, setOutput] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const outputUrl = useMemo(() => output ? URL.createObjectURL(output) : '', [output]);

  async function process() {
    if (!file) return;
    setBusy(true); setStatus('Decoding audio…'); setOutput(null);
    try {
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      setStatus('Reducing noise…');
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => applyNoiseReduction(decoded.getChannelData(c), { reduction, highPassHz: 70 }));
      const blob = encodeWav(channels, decoded.sampleRate);
      setOutput(blob); setStatus(`Done • ${Math.max(0, Math.round((1 - blob.size / file.size) * 100))}% size change`);
      await context.close();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Noise reduction failed.'); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-3xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">Audio Noise Reducer</h1><p className="text-sm opacity-70">Reduce steady background noise locally in your browser.</p></header>
    <input ref={inputRef} hidden type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    <button className="rounded border px-4 py-2" onClick={() => inputRef.current?.click()}>Choose audio</button>
    {file && <div className="rounded border p-4 text-sm">{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
    <label className="block">Reduction: {Math.round(reduction * 100)}%
      <input className="mt-2 w-full" type="range" min="0" max="100" value={Math.round(reduction * 100)} onChange={(e) => setReduction(Number(e.target.value) / 100)} />
    </label>
    <button disabled={!file || busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" onClick={process}>{busy ? 'Processing…' : 'Reduce Noise'}</button>
    <p className="text-sm" aria-live="polite">{status}</p>
    {outputUrl && <a className="inline-block rounded border px-4 py-2" href={outputUrl} download="flixo-noise-reduced.wav">Download WAV</a>}
  </section>;
}
