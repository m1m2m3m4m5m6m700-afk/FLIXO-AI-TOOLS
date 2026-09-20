import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_FILTER_FAMILIES, LIVE_FILTER_REGISTRY, getLiveFilter } from './registry';
import { FILTER_MASK_ASPECT_RATIOS, parseFilterMaskHandoff, type FilterMaskParameters } from './handoff';
import { FILTER_MASK_I18N } from './locales';
import type { Locale } from '@/lib/i18n';

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));
const FAVORITES_KEY = 'flixo.filter-mask.favorites.v1';
const RECENT_KEY = 'flixo.filter-mask.recent.v1';

function readStoredIds(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: readonly string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Local persistence is optional; the live camera surface remains usable.
  }
}

const canvasDimensions = (
  video: HTMLVideoElement,
  aspectRatio: FilterMaskParameters['aspectRatio'],
): { width: number; height: number } => {
  const [rawWidth, rawHeight] = aspectRatio.split(':').map(Number);
  const ratio = rawWidth / rawHeight;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const longSide = Math.min(1280, Math.max(sourceWidth, sourceHeight));

  if (ratio >= 1) {
    return { width: Math.round(longSide), height: Math.round(longSide / ratio) };
  }
  return { width: Math.round(longSide * ratio), height: Math.round(longSide) };
};

function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  cssFilter: string,
  intensity: number,
  zoom: number,
  mirror: boolean,
  aspectRatio: FilterMaskParameters['aspectRatio'],
) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const targetAspect = width / height;
  const sourceAspect = sourceWidth / sourceHeight;
  const baseCropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
  const baseCropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
  const cropWidth = Math.min(sourceWidth, baseCropWidth / zoom);
  const cropHeight = Math.min(sourceHeight, baseCropHeight / zoom);
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;

  const drawLayer = (filter: string, alpha: number) => {
    ctx.save();
    ctx.filter = filter;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );
    ctx.restore();
  };

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  if (cssFilter === 'none' || intensity >= 100) {
    drawLayer(cssFilter === 'none' ? 'none' : cssFilter, 1);
  } else {
    drawLayer('none', 1);
    drawLayer(cssFilter, intensity / 100);
  }
  ctx.restore();
}

export function FilterMaskTool({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = FILTER_MASK_I18N[locale] ?? FILTER_MASK_I18N.en;
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
  const [favorites, setFavorites] = useState<string[]>(() => readStoredIds(FAVORITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => readStoredIds(RECENT_KEY).slice(0, 8));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(handoff?.canonicalId ?? 'effect.original');
  const [intensity, setIntensity] = useState(handoff?.parameters.intensity ?? 100);
  const [zoom, setZoom] = useState(handoff?.parameters.zoom ?? 1);
  const [mirror, setMirror] = useState(handoff?.parameters.mirror ?? true);
  const [aspectRatio, setAspectRatio] = useState<FilterMaskParameters['aspectRatio']>(handoff?.parameters.aspectRatio ?? '9:16');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedKind, setCapturedKind] = useState<'photo' | 'video' | null>(null);

  const selected = getLiveFilter(selectedId) ?? LIVE_FILTER_REGISTRY[0];
  const filters = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return LIVE_FILTER_REGISTRY.filter((filter) => {
      const familyMatches = family === 'all' || filter.family === family;
      const queryMatches = !needle
        || `${filter.canonicalId} ${filter.label} ${filter.family}`.toLocaleLowerCase().includes(needle);
      const favoriteMatches = !favoritesOnly || favorites.includes(filter.canonicalId);
      return familyMatches && queryMatches && favoriteMatches;
    });
  }, [family, favorites, favoritesOnly, query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('canonicalId', selected.canonicalId);
    params.set('intensity', String(clampIntensity(intensity)));
    params.set('zoom', String(zoom));
    params.set('mirror', String(mirror));
    params.set('aspectRatio', aspectRatio);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}`);
  }, [selected.canonicalId, aspectRatio, intensity, mirror, zoom]);

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
      setError(copy.cameraUnavailable);
      return;
    }

    const previousStream = streamRef.current;
    let stream: MediaStream | null = null;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      const videos = [baseVideoRef.current, videoRef.current].filter(Boolean) as HTMLVideoElement[];
      videos.forEach((video) => {
        video.srcObject = stream;
      });
      await Promise.all(videos.map((video) => video.play()));

      previousStream?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setRunning(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setRunning(Boolean(previousStream?.active));
      setError(copy.cameraDenied);
    }
  }

  function selectFilter(canonicalId: string) {
    if (!getLiveFilter(canonicalId)) return;
    setSelectedId(canonicalId);
    setRecent((current) => {
      const next = [canonicalId, ...current.filter((id) => id !== canonicalId)].slice(0, 8);
      writeStoredIds(RECENT_KEY, next);
      return next;
    });
  }

  function toggleFavorite(canonicalId: string) {
    setFavorites((current) => {
      const next = current.includes(canonicalId)
        ? current.filter((id) => id !== canonicalId)
        : [canonicalId, ...current];
      writeStoredIds(FAVORITES_KEY, next);
      return next;
    });
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
      setError(copy.recordingUnsupported);
      return;
    }

    const dimensions = canvasDimensions(video, aspectRatio);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    recordCanvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError(copy.recordingUnavailable);
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
          zoom,
          mirror,
          aspectRatio,
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
        setError(copy.recordingFailed);
        recorderRef.current = null;
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      recordFrameRef.current = requestAnimationFrame(drawFrame);
      setRecording(true);
    } catch {
      setError(copy.recordingStartFailed);
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function shareResult() {
    if (!capturedUrl) return;
    const filename = capturedKind === 'video' ? 'flixo-filter-mask.webm' : 'flixo-filter-mask.jpg';

    if (!navigator.share) {
      setError(copy.shareUnsupported);
      return;
    }

    try {
      const blob = await (await fetch(capturedUrl)).blob();
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        setError(copy.shareFileUnsupported);
        return;
      }
      await navigator.share({ title: 'FLIXO Filter Mask', files: [file] });
      setError('');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(copy.shareFailed);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    const dimensions = canvasDimensions(video, aspectRatio);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawFilteredFrame(
      ctx,
      video,
      canvas.width,
      canvas.height,
      selected.cssFilter,
      intensity,
      zoom,
      mirror,
      aspectRatio,
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
          <h2 id="filter-mask-title" style={{ margin: 0 }}>{copy.title}</h2>
          <small aria-live="polite">{copy.selected}: {selected.label} · {selected.canonicalId}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void start()} disabled={running}>{copy.startCamera}</button>
          <button type="button" onClick={stop} disabled={!running}>{copy.stop}</button>
          <button type="button" onClick={switchCamera} disabled={!running}>{copy.switchCamera}</button>
          <button type="button" onClick={() => void capture()} disabled={!running || recording}>{copy.photo}</button>
          {!recording
            ? <button type="button" onClick={startRecording} disabled={!running}>{copy.recordVideo}</button>
             : <button type="button" onClick={stopRecording}>{copy.stopRecording}</button>}
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, background: '#111', aspectRatio: aspectRatio.replace(':', ' / ') }}>
        <video
          ref={baseVideoRef}
          playsInline
          muted
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `${mirror ? 'scaleX(-1)' : ''} scale(${zoom})`.trim(),
          }}
        />
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={`${copy.title} live camera`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: selected.cssFilter === 'none' ? undefined : selected.cssFilter,
            opacity: intensity / 100,
            transform: `${mirror ? 'scaleX(-1)' : ''} scale(${zoom})`.trim(),
          }}
        />
        {!running && (
          <button
            type="button"
            onClick={() => void start()}
            style={{ position: 'absolute', inset: '50% auto auto 50%', transform: 'translate(-50%, -50%)' }}
          >
            {copy.startCamera}
          </button>
        )}
      </div>

      {error && <p role="alert">{error}</p>}

      <label>
        {copy.searchFilters}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
      </label>

      <div role="group" aria-label={copy.filterFamilies} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={family === 'all' && !favoritesOnly} onClick={() => { setFamily('all'); setFavoritesOnly(false); }} >{copy.all}</button>
        <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((current) => !current)} >{copy.favorites}</button>
        {LIVE_FILTER_FAMILIES.map((filterFamily) => (
          <button
            key={filterFamily}
            type="button"
            aria-pressed={family === filterFamily}
            onClick={() => { setFamily(filterFamily); setFavoritesOnly(false); }}
          >
            {copy.family[filterFamily]}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div role="group" aria-label={copy.recent} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <strong>{copy.recent}:</strong>
          {recent.map((canonicalId) => {
            const recentFilter = getLiveFilter(canonicalId);
            if (!recentFilter) return null;
            return (
              <button
                key={canonicalId}
                type="button"
                aria-label={`${copy.recent} ${recentFilter.label}`}
                onClick={() => selectFilter(canonicalId)}
              >
                {recentFilter.label}
              </button>
            );
          })}
        </div>
      )}

      <div role="group" aria-label={copy.selected} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-pressed={favorites.includes(selected.canonicalId)}
          onClick={() => toggleFavorite(selected.canonicalId)}
        >
          {favorites.includes(selected.canonicalId) ? copy.favoriteActive : copy.favorite}
        </button>
        <button type="button" onClick={() => selectFilter('effect.original')}>{copy.reset}</button>
      </div>

      <div role="group" aria-label={copy.aspectRatio} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTER_MASK_ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio}
            type="button"
            aria-pressed={aspectRatio === ratio}
            onClick={() => setAspectRatio(ratio)}
          >
            {ratio}
          </button>
        ))}
      </div>

      <div role="group" aria-label={copy.cameraFraming} style={{ display: 'grid', gap: 8 }}>
        <label>
          {copy.zoom}: {zoom.toFixed(1)}×
          <input
            aria-label={copy.zoom}
            type="range"
            min="1"
            max="2"
            step="0.1"
            value={zoom}
            onChange={(event) => setZoom(Math.min(2, Math.max(1, Number(event.target.value))))}
          />
        </label>
        <button type="button" aria-pressed={mirror} onClick={() => setMirror((current) => !current)}>
          {mirror ? copy.mirrorOn : copy.mirrorOff}
        </button>
      </div>

      <label>
        {copy.intensity}: {intensity}%
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
            onClick={() => selectFilter(filter.canonicalId)}
          >
            <strong>{filter.label}</strong>
            <small style={{ display: 'block', opacity: .6 }}>{filter.canonicalId}</small>
          </button>
        ))}
      </div>

      {capturedUrl && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href={capturedUrl}
            download={capturedKind === 'video' ? 'flixo-filter-mask.webm' : 'flixo-filter-mask.jpg'}
          >
            {copy.download}
          </a>
          <button type="button" onClick={() => void shareResult()}>
            {copy.share}
          </button>
        </div>
      )}
    </section>
  );
}
