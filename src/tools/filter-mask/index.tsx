import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_FILTER_REGISTRY } from './registry';

export function FilterMaskTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('effect.original');
  const [intensity, setIntensity] = useState(100);

  const selected = LIVE_FILTER_REGISTRY.find((filter) => filter.canonicalId === selectedId) ?? LIVE_FILTER_REGISTRY[0];
  const filters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return LIVE_FILTER_REGISTRY.filter((filter) => !needle || (filter.canonicalId + ' ' + filter.label).toLowerCase().includes(needle));
  }, [query]);
  const liveFilter = intensity === 100 || selected.cssFilter === 'none' ? selected.cssFilter : selected.cssFilter + ' opacity(' + intensity / 100 + ')';

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
    } catch {
      setError('Camera access was denied or unavailable.');
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = liveFilter === 'none' ? 'none' : liveFilter;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'flixo-filter-mask.jpg';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="filter-mask-title" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="filter-mask-title" style={{ margin: 0 }}>Filter Mask</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void start()} disabled={running}>Start camera</button>
          <button type="button" onClick={stop} disabled={!running}>Stop camera</button>
          <button type="button" onClick={() => void capture()} disabled={!running}>Capture</button>
        </div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, background: '#111', aspectRatio: '16 / 10' }}>
        <video ref={videoRef} playsInline muted aria-label="Filter Mask live camera" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: liveFilter, transform: 'scaleX(-1)' }} />
        {!running && <button type="button" onClick={() => void start()} style={{ position: 'absolute', inset: '50% auto auto 50%', transform: 'translate(-50%, -50%)' }}>Start camera</button>}
      </div>
      {error && <p role="alert">{error}</p>}
      <label>Search filters<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filters" /></label>
      <label>Intensity: {intensity}%<input type="range" min="25" max="100" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
        {filters.map((filter) => <button key={filter.canonicalId} type="button" aria-pressed={filter.canonicalId === selectedId} onClick={() => setSelectedId(filter.canonicalId)} style={{ padding: 8, borderRadius: 12, outline: filter.canonicalId === selectedId ? '2px solid currentColor' : undefined }}><strong>{filter.label}</strong><small style={{ display: 'block', opacity: .6 }}>{filter.canonicalId}</small></button>)}
      </div>
    </section>
  );
}
