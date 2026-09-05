import { useMemo, useState } from 'react';
import { processVideo, type AudioAction, getMediaMetadata } from './engine';

export function AudioExtractorMuterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [action, setAction] = useState<AudioAction>('extract');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('');

  const actionLabel = useMemo(() => action === 'extract' ? 'Extract audio' : 'Mute video', [action]);

  const onFile = async (next: File | null) => {
    if (!next) return;
    setFile(next);
    setError('');
    setStatus('Reading video…');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    try {
      const metadata = await getMediaMetadata(next);
      setEnd(Number(metadata.duration.toFixed(2)));
      setStart(0);
      setStatus(`${metadata.width}×${metadata.height} • ${metadata.duration.toFixed(2)}s`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read video');
      setStatus('');
    }
  };

  const run = async () => {
    if (!file) return;
    setError('');
    setStatus(`${actionLabel} locally…`);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    try {
      const blob = await processVideo(file, action, start, end);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setOutputName(action === 'extract' ? 'flixo-audio.webm' : 'flixo-muted.webm');
      setStatus(`Ready • ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Processing failed');
      setStatus('');
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Audio Extractor &amp; Muter</h1>
        <p className="text-sm text-muted-foreground">Extract audio or remove audio from a video locally in your browser.</p>
      </header>
      <label className="rounded-xl border border-dashed p-8 text-center">
        <span className="mb-3 block text-sm">Select a video file</span>
        <input aria-label="Video file" type="file" accept="video/*" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <div className="grid gap-4 rounded-xl border p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Action<select value={action} onChange={(event) => setAction(event.target.value as AudioAction)}><option value="extract">Extract audio</option><option value="mute">Mute video</option></select></label>
            <label className="grid gap-1 text-sm">Start (seconds)<input type="number" min="0" step="0.01" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label>
          </div>
          <label className="grid gap-1 text-sm">End (seconds)<input type="number" min="0" step="0.01" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label>
          <button type="button" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground" onClick={() => void run()}>{actionLabel}</button>
        </div>
      )}
      {status && <p role="status" className="text-sm">{status}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {downloadUrl && <a className="rounded-lg border px-4 py-2 text-center font-medium" href={downloadUrl} download={outputName}>Download output</a>}
    </section>
  );
}
