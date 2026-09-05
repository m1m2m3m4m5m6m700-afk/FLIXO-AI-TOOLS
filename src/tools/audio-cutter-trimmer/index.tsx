import { useEffect, useRef, useState } from 'react';
import { buildWaveform, clampAudioRange, encodeWav, formatAudioTime } from './engine';

async function decodeAudio(file: File): Promise<AudioBuffer> {
  const AudioCtx = globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API is unavailable in this browser.');
  const context = new AudioCtx();
  try {
    const bytes = await file.arrayBuffer();
    return await context.decodeAudioData(bytes.slice(0));
  } finally {
    await context.close();
  }
}

function drawWaveform(canvas: HTMLCanvasElement, waveform: number[], startRatio: number, endRatio: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'currentColor';
  ctx.lineWidth = 2;
  const mid = height / 2;
  const step = width / Math.max(1, waveform.length);
  waveform.forEach((value, index) => {
    const x = index * step + step / 2;
    const amplitude = value * (height * 0.42);
    ctx.beginPath();
    ctx.moveTo(x, mid - amplitude);
    ctx.lineTo(x, mid + amplitude);
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, Math.max(0, width * startRatio), height);
  ctx.fillRect(Math.min(width, width * endRatio), 0, Math.max(0, width * (1 - endRatio)), height);
}

export function AudioCutterTrimmerTool() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  }, [outputUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWaveform(canvas, waveform, duration ? start / duration : 0, duration ? end / duration : 1);
  }, [waveform, start, end, duration]);

  const choose = async (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    setError('');
    setStatus('Decoding locally…');
    try {
      const audio = await decodeAudio(next);
      const mono = new Float32Array(audio.length);
      for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
        const data = audio.getChannelData(channel);
        for (let i = 0; i < audio.length; i += 1) mono[i] += (data[i] ?? 0) / audio.numberOfChannels;
      }
      const nextDuration = audio.duration;
      setFile(next);
      setDuration(nextDuration);
      setStart(0);
      setEnd(nextDuration);
      setWaveform(buildWaveform(mono));
      setStatus(`${nextDuration.toFixed(2)}s · ${(next.size / 1024 / 1024).toFixed(2)} MB`);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to decode the audio file.');
      setStatus('');
    }
  };

  const exportClip = async () => {
    if (!file || duration <= 0) return;
    const range = clampAudioRange(start, end, duration);
    if (range.end - range.start <= 0) {
      setError('Choose a positive audio range.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Rendering selected range locally…');
    try {
      const source = await decodeAudio(file);
      const frameStart = Math.floor(range.start * source.sampleRate);
      const frameEnd = Math.min(source.length, Math.floor(range.end * source.sampleRate));
      const frameCount = Math.max(1, frameEnd - frameStart);
      const context = new OfflineAudioContext(source.numberOfChannels, frameCount, source.sampleRate);
      const clip = context.createBuffer(source.numberOfChannels, frameCount, source.sampleRate);
      for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
        clip.copyToChannel(source.getChannelData(channel).subarray(frameStart, frameEnd), channel);
      }
      const wav = encodeWav(clip);
      const blob = new Blob([wav], { type: 'audio/wav' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setStatus(`Ready · ${formatAudioTime(range.start)} → ${formatAudioTime(range.end)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export the selected range.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const safeRange = clampAudioRange(start, end, duration);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-background p-6 text-foreground">
      <div>
        <h1 className="text-2xl font-bold">Audio Cutter & Trimmer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cut audio locally with precise start/end controls and a waveform preview.</p>
      </div>
      <label className="rounded-xl border border-dashed border-border p-6 text-center">
        <span className="mb-3 block font-medium">Choose audio</span>
        <input aria-label="Audio file" type="file" accept="audio/*" onChange={(event) => void choose(event.target.files?.[0])} />
      </label>
      <canvas ref={canvasRef} width={900} height={180} aria-label="Audio waveform" className="h-44 w-full rounded-xl border border-border p-2" />
      <div className="grid gap-4 md:grid-cols-2">
        <label>Start <input aria-label="Start time" className="mt-1 w-full rounded border p-2" type="number" min={0} max={duration} step={0.01} value={safeRange.start} onChange={(event) => setStart(Number(event.target.value))} /></label>
        <label>End <input aria-label="End time" className="mt-1 w-full rounded border p-2" type="number" min={0} max={duration} step={0.01} value={safeRange.end} onChange={(event) => setEnd(Number(event.target.value))} /></label>
      </div>
      <div className="text-sm text-muted-foreground">Selected: {formatAudioTime(safeRange.start)} → {formatAudioTime(safeRange.end)}</div>
      <button type="button" disabled={!file || busy} onClick={() => void exportClip()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Rendering…' : 'Export WAV clip'}</button>
      {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {outputUrl ? <a href={outputUrl} download="flixo-audio-clip.wav" className="rounded-xl border border-border px-4 py-3 text-center font-semibold">Download WAV clip</a> : null}
    </section>
  );
}
