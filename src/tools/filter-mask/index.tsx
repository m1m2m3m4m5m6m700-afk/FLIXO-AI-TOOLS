import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_FILTER_FAMILIES, LIVE_FILTER_REGISTRY, getLiveFilter } from './registry';
import { FILTER_MASK_ASPECT_RATIOS, FILTER_MASK_CAPTURE_QUALITIES, parseFilterMaskHandoff, type FilterMaskParameters } from './handoff';
import { FILTER_MASK_I18N } from './locales';
import { canvasDimensions, drawFilteredFrame, frameCrop } from './frame-renderer';
import { createWebGL2FilterRenderer } from './gpu-renderer';
import { benchmarkLiveRenderBackend, scheduleVideoFrames } from './performance';
import type { Locale } from '@/lib/i18n';

const clampIntensity = (value: number): number => Math.min(100, Math.max(25, Math.round(value)));
const videoExtensionForMime = (mimeType: string): string => mimeType.includes('mp4') ? 'mp4' : 'webm';
const FAVORITES_KEY = 'flixo.filter-mask.favorites.v1';
const RECENT_KEY = 'flixo.filter-mask.recent.v1';
const PRESETS_KEY = 'flixo.filter-mask.presets.v1';

type FilterMaskPreset = Readonly<{
  id: string;
  name: string;
  canonicalId: string;
  intensity: number;
  zoom: number;
  mirror: boolean;
  aspectRatio: FilterMaskParameters['aspectRatio'];
  captureQuality?: FilterMaskParameters['captureQuality'];
}>;

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

function readStoredPresets(): FilterMaskPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is FilterMaskPreset =>
      value && typeof value === 'object'
      && typeof value.id === 'string'
      && typeof value.name === 'string'
      && typeof value.canonicalId === 'string'
      && typeof value.intensity === 'number'
      && typeof value.zoom === 'number'
      && typeof value.mirror === 'boolean'
      && Number.isFinite(value.intensity)
      && value.intensity >= 25 && value.intensity <= 100
      && Number.isFinite(value.zoom)
      && value.zoom >= 1 && value.zoom <= 2
      && typeof value.aspectRatio === 'string'
      && FILTER_MASK_ASPECT_RATIOS.includes(value.aspectRatio as FilterMaskParameters['aspectRatio'])
      && (value.captureQuality === undefined || FILTER_MASK_CAPTURE_QUALITIES.includes(value.captureQuality as FilterMaskParameters['captureQuality']))
      && getLiveFilter(value.canonicalId) !== undefined,
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function writeStoredPresets(presets: readonly FilterMaskPreset[]) {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 20)));
  } catch {
    // Preset persistence is optional; the live camera surface remains usable.
  }
}

export function FilterMaskTool({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = FILTER_MASK_I18N[locale] ?? FILTER_MASK_I18N.en;
  const videoRef = useRef<HTMLVideoElement>(null);
  const baseVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordSchedulerRef = useRef<{ cancel: () => void } | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const gpuRendererRef = useRef<ReturnType<typeof createWebGL2FilterRenderer> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void>; released: boolean } | null>(null);
  const recordingPausedRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const recordingMetricsRef = useRef({
    frames: 0,
    droppedFrames: 0,
    lastPresentedFrames: null as number | null,
    lastFrameNow: null as number | null,
    metricStartedAt: 0,
    metricFrames: 0,
    metricDrops: 0,
  });
  const chunksRef = useRef<Blob[]>([]);

  const handoff = useMemo(
    () => (typeof window === 'undefined' ? null : parseFilterMaskHandoff(window.location.search)),
    [],
  );

  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<'all' | (typeof LIVE_FILTER_FAMILIES[number])>('all');
  const [favorites, setFavorites] = useState<string[]>(() => readStoredIds(FAVORITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => readStoredIds(RECENT_KEY).slice(0, 8));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterMaskPreset[]>(() => readStoredPresets());
  const [selectedId, setSelectedId] = useState(handoff?.canonicalId ?? 'effect.original');
  const [intensity, setIntensity] = useState(handoff?.parameters.intensity ?? 100);
  const [zoom, setZoom] = useState(handoff?.parameters.zoom ?? 1);
  const [mirror, setMirror] = useState(handoff?.parameters.mirror ?? true);
  const [torch, setTorch] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<FilterMaskParameters['aspectRatio']>(handoff?.parameters.aspectRatio ?? '9:16');
  const [captureQuality, setCaptureQuality] = useState<FilterMaskParameters['captureQuality']>(handoff?.parameters.captureQuality ?? '1080p');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedFilename, setCapturedFilename] = useState<string>('flixo-filter-mask.jpg');
  const [recordPaused, setRecordPaused] = useState(false);
  const [recordFps, setRecordFps] = useState(0);
  const [recordDroppedFrames, setRecordDroppedFrames] = useState(0);
  const [recordRenderBackend, setRecordRenderBackend] = useState<'canvas2d' | 'webgl2'>('canvas2d');

  const selected = getLiveFilter(selectedId) ?? LIVE_FILTER_REGISTRY[0];
  const selectedRef = useRef(selected);
  const intensityRef = useRef(intensity);
  const zoomRef = useRef(zoom);
  const mirrorRef = useRef(mirror);

  useEffect(() => {
    selectedRef.current = selected;
    intensityRef.current = intensity;
    zoomRef.current = zoom;
    mirrorRef.current = mirror;
  }, [intensity, mirror, selected, zoom]);

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
    params.set('captureQuality', captureQuality);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}`);
  }, [selected.canonicalId, aspectRatio, captureQuality, intensity, mirror, zoom]);

  async function releaseWakeLock() {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (sentinel && !sentinel.released) {
      try { await sentinel.release(); } catch { /* Wake lock release is best-effort. */ }
    }
  }

  async function acquireWakeLock() {
    const candidate = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; released: boolean }> } };
    if (!candidate.wakeLock?.request) return;
    try {
      wakeLockRef.current = await candidate.wakeLock.request('screen');
    } catch {
      // Screen wake lock is optional and must never block recording.
    }
  }

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') recorderRef.current.stop();
    recordSchedulerRef.current?.cancel();
    recordSchedulerRef.current = null;
    if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current);
    gpuRendererRef.current?.dispose();
    gpuRendererRef.current = null;
    void releaseWakeLock();
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
    const videos = [baseVideoRef.current, videoRef.current].filter(Boolean) as HTMLVideoElement[];
    let stream: MediaStream | null = null;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: captureQuality === '1080p' ? 1920 : 1280 },
            height: { ideal: captureQuality === '1080p' ? 1080 : 720 },
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
      setTorch(false);
      setRunning(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      videos.forEach((video) => {
        video.srcObject = previousStream ?? null;
      });
      setRunning(Boolean(previousStream?.active));
      setTorch(false);
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

  function savePreset() {
    const preset: FilterMaskPreset = {
      id: `${selected.canonicalId}-${Date.now()}`,
      name: presetName.trim().slice(0, 40) || `${selected.label} · ${intensity}% · ${zoom.toFixed(1)}× · ${aspectRatio}`,
      canonicalId: selected.canonicalId,
      intensity,
      zoom,
      mirror,
      aspectRatio,
      captureQuality,
    };

    setPresets((current) => {
      const duplicate = current.some((item) =>
        item.canonicalId === preset.canonicalId
        && item.intensity === preset.intensity
        && item.zoom === preset.zoom
        && item.mirror === preset.mirror
        && item.aspectRatio === preset.aspectRatio
        && (item.captureQuality ?? '1080p') === (preset.captureQuality ?? '1080p'),
      );
      if (duplicate) return current;
      const next = [preset, ...current].slice(0, 20);
      writeStoredPresets(next);
      return next;
    });
    setPresetName('');
  }

  function applyPreset(preset: FilterMaskPreset) {
    if (!getLiveFilter(preset.canonicalId)) return;
    setIntensity(clampIntensity(preset.intensity));
    setZoom(Math.min(2, Math.max(1, preset.zoom)));
    setMirror(preset.mirror);
    setAspectRatio(preset.aspectRatio);
    setCaptureQuality(preset.captureQuality ?? '1080p');
    selectFilter(preset.canonicalId);
  }

  function deletePreset(id: string) {
    setPresets((current) => {
      const next = current.filter((preset) => preset.id !== id);
      writeStoredPresets(next);
      return next;
    });
  }

  async function changeCaptureQuality(next: FilterMaskParameters['captureQuality']) {
    if (next === captureQuality) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      setCaptureQuality(next);
      return;
    }

    try {
      await track.applyConstraints({
        width: { ideal: next === '1080p' ? 1920 : 1280 },
        height: { ideal: next === '1080p' ? 1080 : 720 },
      });
      setCaptureQuality(next);
      setError('');
    } catch {
      setError(copy.qualityChangeFailed);
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (!capabilities.torch) {
      setError(copy.torchUnsupported);
      return;
    }

    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] } as MediaTrackConstraints);
      setTorch(next);
      setError('');
    } catch {
      setError(copy.torchFailed);
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') recorderRef.current.stop();
    recordSchedulerRef.current?.cancel();
    recordSchedulerRef.current = null;
    if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current);
    gpuRendererRef.current?.dispose();
    gpuRendererRef.current = null;
    void releaseWakeLock();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    [baseVideoRef.current, videoRef.current].forEach((video) => {
      if (video) video.srcObject = null;
    });
    setRunning(false);
    setRecording(false);
    setRecordPaused(false);
    setTorch(false);
  }

  function switchCamera() {
    void start(
      streamRef.current?.getVideoTracks()[0]?.getSettings().facingMode === 'environment'
        ? 'user'
        : 'environment',
    );
  }

  async function startRecording() {
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

    const dimensions = canvasDimensions(video, aspectRatio, captureQuality);
    const benchmark = benchmarkLiveRenderBackend(
      video,
      selected.cssFilter,
      intensity,
      zoom,
      mirror,
      dimensions.width,
      dimensions.height,
    );
    const preferredBackend = benchmark.backend;
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    let ctx: CanvasRenderingContext2D | null = null;
    let gpuRenderer = preferredBackend === 'webgl2' ? createWebGL2FilterRenderer(canvas) : null;
    if (preferredBackend === 'webgl2' && !gpuRenderer) {
      ctx = canvas.getContext('2d', { alpha: false });
    } else if (!gpuRenderer) {
      ctx = canvas.getContext('2d', { alpha: false });
    }

    if (!ctx && !gpuRenderer) {
      setError(copy.recordingUnavailable);
      return;
    }

    gpuRendererRef.current = gpuRenderer;
    setRecordRenderBackend(gpuRenderer ? 'webgl2' : 'canvas2d');

    const measuredMs = gpuRenderer ? benchmark.gpuMs : benchmark.baselineMs;
    const frameRate = Number.isFinite(measuredMs ?? Number.POSITIVE_INFINITY) && (measuredMs ?? 0) > 20 ? 24 : 30;
    const outputStream = canvas.captureStream(frameRate);
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) outputStream.addTrack(audioTrack);

    const mimeType = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));

    try {
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recordingPausedRef.current = false;
      recordingMetricsRef.current = {
        frames: 0,
        droppedFrames: 0,
        lastPresentedFrames: null,
        lastFrameNow: null,
        metricStartedAt: performance.now(),
        metricFrames: 0,
        metricDrops: 0,
      };

      const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      const drawFrame = (now: number, metadata: { presentedFrames?: number } | null) => {
        if (recorder.state !== 'recording') return;

        const metrics = recordingMetricsRef.current;
        if (metadata?.presentedFrames !== undefined && metrics.lastPresentedFrames !== null) {
          metrics.droppedFrames += Math.max(0, metadata.presentedFrames - metrics.lastPresentedFrames - 1);
        } else if (metrics.lastFrameNow !== null) {
          const interval = now - metrics.lastFrameNow;
          const expected = 1000 / frameRate;
          metrics.droppedFrames += Math.max(0, Math.round(interval / expected) - 1);
        }
        metrics.lastPresentedFrames = metadata?.presentedFrames ?? metrics.lastPresentedFrames;
        metrics.lastFrameNow = now;
        metrics.frames += 1;

        if (gpuRendererRef.current) {
          gpuRendererRef.current.render(
            video,
            selectedRef.current.cssFilter,
            intensityRef.current,
            frameCrop(video, canvas.width, canvas.height, zoomRef.current),
            mirrorRef.current,
          );
        } else if (ctx) {
          drawFilteredFrame(
            ctx,
            video,
            canvas.width,
            canvas.height,
            selectedRef.current.cssFilter,
            intensityRef.current,
            zoomRef.current,
            mirrorRef.current,
          );
        }

        metrics.metricFrames += 1;
        metrics.metricDrops = metrics.droppedFrames;
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        recordSchedulerRef.current?.cancel();
        recordSchedulerRef.current = null;
        if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        gpuRendererRef.current?.dispose();
        gpuRendererRef.current = null;
        outputStream.getVideoTracks().forEach((track) => track.stop());

        const shouldDiscard = discardRecordingRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        chunksRef.current = [];

        if (!shouldDiscard && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setCapturedUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return url;
          });
          setCapturedFilename(`flixo-filter-mask.${videoExtensionForMime(recorder.mimeType || mimeType || 'video/webm')}`);
        }

        discardRecordingRef.current = false;
        recordingPausedRef.current = false;
        setRecording(false);
        setRecordPaused(false);
        setRecordSeconds(0);
        void releaseWakeLock();
        recorderRef.current = null;
      };

      recorder.onerror = () => {
        recordSchedulerRef.current?.cancel();
        recordSchedulerRef.current = null;
        if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        gpuRendererRef.current?.dispose();
        gpuRendererRef.current = null;
        outputStream.getVideoTracks().forEach((track) => track.stop());
        chunksRef.current = [];
        recordingPausedRef.current = false;
        setRecording(false);
        setRecordPaused(false);
        setRecordSeconds(0);
        void releaseWakeLock();
        setError(copy.recordingFailed);
        recorderRef.current = null;
      };

      recorder.start(1000);
      recordSchedulerRef.current = scheduleVideoFrames(video, drawFrame);
      setRecordSeconds(0);
      setRecordFps(0);
      setRecordDroppedFrames(0);
      recordTimerRef.current = window.setInterval(() => {
        const metrics = recordingMetricsRef.current;
        if (recorder.state === 'recording') {
          setRecordSeconds((seconds) => seconds + 1);
          const elapsed = Math.max(0.001, (performance.now() - metrics.metricStartedAt) / 1000);
          setRecordFps(Math.round(metrics.frames / elapsed));
          setRecordDroppedFrames(metrics.droppedFrames);
        }
      }, 1000);
      setRecording(true);
      setRecordPaused(false);
      await acquireWakeLock();
    } catch {
      gpuRendererRef.current?.dispose();
      gpuRendererRef.current = null;
      outputStream.getVideoTracks().forEach((track) => track.stop());
      setError(copy.recordingStartFailed);
      recorderRef.current = null;
    }
  }


  const formatRecordTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  function toggleRecordingPause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      recordingPausedRef.current = true;
      setRecordPaused(true);
      return;
    }
    if (recorder.state === 'paused') {
      recorder.resume();
      recordingPausedRef.current = false;
      setRecordPaused(false);
    }
  }

  function cancelRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    discardRecordingRef.current = true;
    if (recorder.state === 'paused') recorder.resume();
    if (recorder.state === 'recording') recorder.stop();
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording' || recorderRef.current?.state === 'paused') recorderRef.current.stop();
  }

  async function shareSetup() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FLIXO Filter Mask', url });
        setError('');
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(copy.shareSetupFailed);
        return;
      }
    }

    if (!navigator.clipboard?.writeText) {
      setError(copy.shareSetupUnsupported);
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setError('');
    } catch {
      setError(copy.shareSetupFailed);
    }
  }

  async function shareResult() {
    if (!capturedUrl) return;
    const filename = capturedFilename;

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

    const dimensions = canvasDimensions(video, aspectRatio, captureQuality);
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
    setCapturedFilename('flixo-filter-mask.jpg');
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
          <button type="button" onClick={stop} disabled={!running || recording}>{copy.stop}</button>
          <button type="button" onClick={switchCamera} disabled={!running || recording}>{copy.switchCamera}</button>
          <button type="button" aria-pressed={torch} onClick={() => void toggleTorch()} disabled={!running || recording}>{torch ? copy.torchOn : copy.torchOff}</button>
          <button type="button" onClick={() => void capture()} disabled={!running || recording}>{copy.photo}</button>
          {!recording
            ? <button type="button" onClick={() => void startRecording()} disabled={!running}>{copy.recordVideo}</button>
             : <>
                 <button type="button" onClick={toggleRecordingPause}>{recordPaused ? copy.resumeRecording : copy.pauseRecording}</button>
                 <button type="button" onClick={stopRecording}>{copy.stopRecording}</button>
                 <button type="button" onClick={cancelRecording}>{copy.cancelRecording}</button>
               </>}
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

      {recording && (
        <small aria-live="polite">
          {copy.recordingPerformance}: {recordRenderBackend === 'webgl2' ? copy.recordingBackendGpu : copy.recordingBackendCanvas} · {recordFps} FPS · {recordDroppedFrames} drops · {formatRecordTime(recordSeconds)}
        </small>
      )}

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

      <div role="group" aria-label={copy.presets} style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <strong>{copy.presets}</strong>
          <label>
            {copy.presetName}
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder={copy.presetNamePlaceholder}
              maxLength={40}
            />
          </label>
          <button type="button" onClick={savePreset}>{copy.savePreset}</button>
        </div>
        {presets.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((preset) => (
              <div key={preset.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <button type="button" onClick={() => applyPreset(preset)}>{preset.name}</button>
                <button type="button" aria-label={`${copy.deletePreset} ${preset.name}`} onClick={() => deletePreset(preset.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
            disabled={recording}
            onClick={() => setAspectRatio(ratio)}
          >
            {ratio}
          </button>
        ))}
      </div>

      <div role="group" aria-label={copy.captureQuality} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTER_MASK_CAPTURE_QUALITIES.map((quality) => (
          <button
            key={quality}
            type="button"
            aria-pressed={captureQuality === quality}
            disabled={recording}
            onClick={() => void changeCaptureQuality(quality)}
          >
            {quality === '1080p' ? copy.quality1080 : copy.quality720}
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
            download={capturedFilename}
          >
            {copy.download}
          </a>
          <button type="button" onClick={() => void shareResult()}>
            {copy.share}
          </button>
          <button type="button" onClick={() => void shareSetup()}>
            {copy.shareSetup}
          </button>
        </div>
      )}
    </section>
  );
}
