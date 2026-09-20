import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_FILTER_REGISTRY } from './registry';

export function FilterMaskTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('effect.original');
  const [intensity, setIntensity] = useState(100);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedKind, setCapturedKind] = useState<'photo' | 'video' | null>(null);

  const selected = LIVE_FILTER_REGISTRY.find((filter) => filter.canonicalId === selectedId) ?? LIVE_FILTER_REGISTRY[0];
  const filters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return LIVE_FILTER_REGISTRY.filter((filter) => !needle || (filter.canonicalId + ' ' + filter.label).toLowerCase().includes(needle));
  }, [query]);
  const liveFilter = intensity === 100 || selected.cssFilter === 'none' ? selected.cssFilter : selected.cssFilter + ' opacity(' + intensity / 100 + ')';

  useEffect(() => () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
  }, [capturedUrl]);

  async function start(facingMode: 'user' | 'environment' = 'user') {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser.');
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
    } catch {
      setRunning(false);
      setError('Camera or microphone access was denied or unavailable.');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setRecording(false);
  }

  function switchCamera() {
    void start(streamRef.current?.getVideoTracks()[0]?.getSettings().facingMode === 'environment' ? 'user' : 'environment');
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !('MediaRecorder' in window)) {
      setError('Video recording is not supported in this browser.');
      return;
    }
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setCapturedUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
        setCapturedKind('video');
        setRecording(false);
      };
      recorder.onerror = () => { setRecording(false); setError('Video recording failed.'); };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Video recording could not be started.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
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
    setCapturedUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
    setCapturedKind('photo');
  }

  return (
    <section aria-labelledby="filter-mask-title" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="filter-mask-title" style={{ margin: 0 }}>Filter Mask</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void start()} disabled={running}>Start camera</button>
          <button type="button" onClick={stop} disabled={!running}>Stop</button>
          <button type="button" onClick={switchCamera} disabled={!running}>Switch camera</button>
          <button type="button" onClick={() => void capture()} disabled={!running || recording}>Photo</button>
          {!recording ? <button type="button" onClick={startRecording} disabled={!running}>Record video</button> : <button type="button" onClick={stopRecording}>Stop recording</button>}
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
        {filters.map((filter) => <button key={filter.canonicalId} type="button" aria-pressed={filter.canonicalId === selectedId} onClick={() => setSelectedId(filter.canonicalId)}><strong>{filter.label}</strong><small style={{ display: 'block', opacity: .6 }}>{filter.canonicalId}</small></button>)}
      </div>
      {capturedUrl && <div><a href={capturedUrl} download={capturedKind === 'video' ? 'flixo-filter-mask.webm' : 'flixo-filter-mask.jpg'}>Download result</a></div>}
    </section>
  );
}
