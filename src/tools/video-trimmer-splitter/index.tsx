import React, { useEffect, useMemo, useState } from 'react';
import { exportClip, formatTimestamp, getVideoMetadata, type VideoMetadata } from './engine';

export function VideoTrimmerSplitterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const duration = metadata?.duration ?? 0;
  const clipLength = useMemo(() => Math.max(0, end - start), [end, start]);

  const loadFile = async (nextFile: File) => {
    setError('');
    setStatus('Reading video metadata…');
    setMetadata(null);
    setFile(nextFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(nextFile));
    try {
      const nextMetadata = await getVideoMetadata(nextFile);
      setMetadata(nextMetadata);
      setStart(0);
      setEnd(nextMetadata.duration);
      setStatus('Video ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read video');
      setFile(null);
      setStatus('');
    }
  };

  const exportSelection = async () => {
    if (!file || !metadata) {
      setError('Choose a video first');
      return;
    }
    if (end <= start) {
      setError('End time must be greater than start time');
      return;
    }
    setError('');
    setStatus('Exporting locally…');
    try {
      const blob = await exportClip(file, { start, end });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${file.name.replace(/\.[^.]+$/, '')}-clip.webm`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${formatTimestamp(end - start)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export video');
      setStatus('');
    }
  };

  const reset = () => {
    setFile(null);
    setMetadata(null);
    setStart(0);
    setEnd(0);
    setStatus('');
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Video Trimmer &amp; Splitter</h1>
        <p className="mt-2 opacity-80">Trim video locally in your browser. The fast browser path exports WebM without uploading the source.</p>
      </header>

      <section className="space-y-4 rounded border p-5">
        <label className="block font-semibold" htmlFor="video-file">Video file</label>
        <input id="video-file" type="file" accept="video/*" onChange={(event) => { const next = event.target.files?.[0]; if (next) void loadFile(next); }} />
        {previewUrl && <video src={previewUrl} controls playsInline className="max-h-[420px] w-full rounded border" />}
      </section>

      {metadata && (
        <section className="space-y-5 rounded border p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>Duration: <strong>{formatTimestamp(duration)}</strong></div>
            <div>Resolution: <strong>{metadata.width}×{metadata.height}</strong></div>
            <div>Selected: <strong>{formatTimestamp(clipLength)}</strong></div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">Start
              <input aria-label="Start time" type="range" min="0" max={duration} step="0.01" value={start} onChange={(event) => setStart(Math.min(Number(event.target.value), end))} className="w-full" />
              <span className="block font-mono">{formatTimestamp(start)}</span>
            </label>
            <label className="space-y-2">End
              <input aria-label="End time" type="range" min="0" max={duration} step="0.01" value={end} onChange={(event) => setEnd(Math.max(Number(event.target.value), start))} className="w-full" />
              <span className="block font-mono">{formatTimestamp(end)}</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setStart(0); setEnd(duration); }}>Full video</button>
            <button type="button" onClick={() => setEnd(Math.min(duration, start + 5))}>Next 5 seconds</button>
            <button type="button" onClick={() => setStart(Math.max(0, end - 5))}>Last 5 seconds</button>
            <button type="button" onClick={() => void exportSelection()}>Export clip</button>
            <button type="button" onClick={reset}>Reset</button>
          </div>
        </section>
      )}

      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
