import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_FILTER_FAMILIES, LIVE_FILTER_REGISTRY, getLiveFilter } from './registry';
import { parseFilterMaskHandoff } from './handoff';

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));

function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  cssFilter: string,
  intensity: number,
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  if (cssFilter === 'none') {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(video, 0, 0, width, height);
  } else if (intensity >= 100) {
    ctx.filter = cssFilter;
    ctx.globalAlpha = 1;
    ctx.drawImage(video, 0, 0, width, height);
  } else {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(video, 0, 0, width, height);
    ctx.filter = cssFilter;
    ctx.globalAlpha = intensity / 100;
    ctx.drawImage(video, 0, 0, width, height);
  }

  ctx.restore();
}

export function FilterMaskTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const baseVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handoff = useMemo(
    () => (typeof window === 'undefined' ? null : parseFilterMaskHandoff(window.location.search)),
    [],
  );

  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<'all' | (typeof LIVE_FILTER_FAMILIES[number])>('all');
  const [selectedId, setSelectedId] = useState(handoff?.canonicalId ?? 'effect.original');
  const [intensity, setIntensity] = useState(handoff?.parameters.intensity ?? 100);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedKind, setCapturedKind] = useState<'photo' | 'video' | null>(null);

  const selected = getLiveFilter(selectedId) ?? LIVE_FILTER_REGISTRY[0];
  const filters = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return LIVE_FILTER_REGISTRY.filter((filter) => {
      const familyMatches = family === 'all' || filter.family === family;
      const queryMatches = !needle
        || `${filter.canonicalId} ${filter.label} ${filter.family}`.toLocaleLowerCase().includes(needle);
      return familyMatches && queryMatches;
    });
  }, [family, query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('canonicalId', selected.canonicalId);
    params.set('intensity', String(clampIntensity(intensity)));
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}`);
  }, [selected.canonicalId, intensity]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (recordFrameRef.current !== null) cancelAnimationFrame(recordFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    baseVideoRef.current?.srcObject && (baseVideoRef.current.srcObject = null);
    videoRef.current?.srcObject && (videoRef.current.srcObject = null);
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
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      const videos = [baseVideoRef.current, videoRef.current].filter(Boolean) as HTMLVideoElement[];
      videos.forEach((video) => {
        video.srcObject = stream;
      });
      await Promise.all(videos.map((video) => video.play()));
      setRunning(true);
    } catch {
      setRunning(false);
      setError('Camera or microphone access was denied or unavailable.');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (recordFrameRef.current !== null) cancelAnimationFrame(recordFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    [baseVideoRef.current, videoRef.current].forEach((video) => {
      if (video) video.srcObject = null;
    });
    setRunning(false);
    setRecording(false);
  }

  function switchCamera() {
    void start(
      streamRef.current?.getVideoTracks()[0]?.getSettings().facingMode === 'environment'
        ? 'user'
        : 'environment',
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    const video = videoRef.current;

    if (
      !stream
      || !video
      || !('MediaRecorder' in window)
      || !('captureStream' in HTMLCanvasElement.prototype)
    ) {
      setError('Video recording with live effects is not supported in this browser.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    recordCanvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Video recording is unavailable.');
      return;
    }

    const outputStream = canvas.captureStream(30);
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) outputStream.addTrack(audioTrack);

    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);

      const drawFrame = () => {
        if (recorder.state !== 'recording') return;

        drawFilteredFrame(
          ctx,
          video,
          canvas.width,
          canvas.height,
          selected.cssFilter,
          intensity,
        );
        recordFrameRef.current = requestAnimationFrame(drawFrame);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (recordFrameRef.current !== null) cancelAnimationFrame(recordFrameRef.current);
        recordFrameRef.current = null;
        outputStream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setCapturedUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
        setCapturedKind('video');
        setRecording(false);
        recorderRef.current = null;
      };

      recorder.onerror = () => {
        setRecording(false);
        setError('Video recording failed.');
        recorderRef.current = null;
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      recordFrameRef.current = requestAnimationFrame(drawFrame);
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

    drawFilteredFrame(
      ctx,
      video,
      canvas.width,
      canvas.height,
      selected.cssFilter,
      intensity,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    setCapturedUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });
    setCapturedKind('photo');
  }

  return (
    <section aria-labelledby="filter-mask-title" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 id="filter-mask-title" style={{ margin: 0 }}>Filter Mask</h2>
          <small aria-live="polite">Selected: {selected.label} · {selected.canonicalId}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void start()} disabled={running}>Start camera</button>
          <button type="button" onClick={stop} disabled={!running}>Stop</button>
          <button type="button" onClick={switchCamera} disabled={!running}>Switch camera</button>
          <button type="button" onClick={() => void capture()} disabled={!running || recording}>Photo</button>
          {!recording
            ? <button type="button" onClick={startRecording} disabled={!running}>Record video</button>
            : <button type="button" onClick={stopRecording}>Stop recording</button>}
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, background: '#111', aspectRatio: '16 / 10' }}>
        <video
          ref={baseVideoRef}
          playsInline
          muted
          aria-hidden="true"
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Filter Mask live camera"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: selected.cssFilter === 'none' ? undefined : selected.cssFilter,
            opacity: intensity / 100,
            transform: 'scaleX(-1)',
          }}
        />
        {!running && (
          <button
            type="button"
            onClick={() => void start()}
            style={{ position: 'absolute', inset: '50% auto auto 50%', transform: 'translate(-50%, -50%)' }}
          >
            Start camera
          </button>
        )}
      </div>

      {error && <p role="alert">{error}</p>}

      <label>
        Search filters
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filters" />
      </label>

      <div role="group" aria-label="Filter families" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>All</button>
        {LIVE_FILTER_FAMILIES.map((filterFamily) => (
          <button
            key={filterFamily}
            type="button"
            aria-pressed={family === filterFamily}
            onClick={() => setFamily(filterFamily)}
          >
            {filterFamily}
          </button>
        ))}
      </div>

      <label>
        Intensity: {intensity}%
        <input
          type="range"
          min="25"
          max="100"
          value={intensity}
          onChange={(event) => setIntensity(clampIntensity(Number(event.target.value)))}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
        {filters.map((filter) => (
          <button
            key={filter.canonicalId}
            type="button"
            aria-pressed={filter.canonicalId === selectedId}
            data-filter-canonical-id={filter.canonicalId}
            onClick={() => setSelectedId(filter.canonicalId)}
          >
            <strong>{filter.label}</strong>
            <small style={{ display: 'block', opacity: .6 }}>{filter.canonicalId}</small>
          </button>
        ))}
      </div>

      {capturedUrl && (
        <div>
          <a
            href={capturedUrl}
            download={capturedKind === 'video' ? 'flixo-filter-mask.webm' : 'flixo-filter-mask.jpg'}
          >
            Download result
          </a>
        </div>
      )}
    </section>
  );
}
