import { createWebGL2FilterRenderer, filterSupportsGpu } from './gpu-renderer';
import { drawFilteredFrame, frameCrop } from './frame-renderer';

export type LiveRenderBackend = 'canvas2d' | 'webgl2';

type VideoFrameMetadataLike = {
  presentedFrames?: number;
};

type VideoFrameCallback = (now: number, metadata: VideoFrameMetadataLike | null) => void;

export type LiveFrameScheduler = Readonly<{
  backend: 'requestVideoFrameCallback' | 'requestAnimationFrame';
  cancel: () => void;
}>;

export type RenderBenchmark = Readonly<{
  backend: LiveRenderBackend;
  baselineMs: number;
  gpuMs: number | null;
  speedup: number | null;
  usedGpu: boolean;
}>;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
};

const benchmarkCanvas2d = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cssFilter: string,
  intensity: number,
  zoom: number,
  mirror: boolean,
  iterations = 6,
): number => {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return Number.POSITIVE_INFINITY;
  const times: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    drawFilteredFrame(ctx, video, canvas.width, canvas.height, cssFilter, intensity, zoom, mirror);
    times.push(performance.now() - start);
  }
  return median(times);
};

export function benchmarkLiveRenderBackend(
  video: HTMLVideoElement,
  cssFilter: string,
  intensity: number,
  zoom: number,
  mirror: boolean,
  width: number,
  height: number,
): RenderBenchmark {
  if (!video.videoWidth || !video.videoHeight || !filterSupportsGpu(cssFilter)) {
    return { backend: 'canvas2d', baselineMs: Number.POSITIVE_INFINITY, gpuMs: null, speedup: null, usedGpu: false };
  }

  const sampleWidth = Math.max(320, Math.min(width, 640));
  const sampleHeight = Math.max(240, Math.min(height, 640));
  const baselineCanvas = document.createElement('canvas');
  baselineCanvas.width = sampleWidth;
  baselineCanvas.height = sampleHeight;
  const baselineMs = benchmarkCanvas2d(video, baselineCanvas, cssFilter, intensity, zoom, mirror);

  const gpuCanvas = document.createElement('canvas');
  gpuCanvas.width = sampleWidth;
  gpuCanvas.height = sampleHeight;
  const gpuRenderer = createWebGL2FilterRenderer(gpuCanvas);
  if (!gpuRenderer) {
    return { backend: 'canvas2d', baselineMs, gpuMs: null, speedup: null, usedGpu: false };
  }

  const crop = frameCrop(video, sampleWidth, sampleHeight, zoom);
  const times: number[] = [];
  try {
    gpuRenderer.render(video, cssFilter, intensity, crop, mirror);
    for (let i = 0; i < 6; i += 1) {
      const start = performance.now();
      gpuRenderer.render(video, cssFilter, intensity, crop, mirror);
      times.push(performance.now() - start);
    }
    const gpuMs = median(times);
    const speedup = Number.isFinite(baselineMs) && gpuMs > 0 ? baselineMs / gpuMs : null;
    const usedGpu = Number.isFinite(gpuMs)
      && Number.isFinite(baselineMs)
      && gpuMs <= baselineMs * 0.9
      && gpuMs <= 28;
    return { backend: usedGpu ? 'webgl2' : 'canvas2d', baselineMs, gpuMs, speedup, usedGpu };
  } finally {
    gpuRenderer.dispose();
  }
}

export function scheduleVideoFrames(video: HTMLVideoElement, callback: VideoFrameCallback): LiveFrameScheduler {
  const candidate = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: (now: number, metadata: VideoFrameMetadataLike) => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };

  if (candidate.requestVideoFrameCallback && candidate.cancelVideoFrameCallback) {
    let active = true;
    let handle = 0;
    const loop = (now: number, metadata: VideoFrameMetadataLike) => {
      if (!active) return;
      callback(now, metadata);
      handle = candidate.requestVideoFrameCallback(loop);
    };
    handle = candidate.requestVideoFrameCallback(loop);
    return {
      backend: 'requestVideoFrameCallback',
      cancel: () => {
        active = false;
        if (handle) candidate.cancelVideoFrameCallback?.(handle);
      },
    };
  }

  let active = true;
  let handle = 0;
  const loop = (now: number) => {
    if (!active) return;
    callback(now, null);
    handle = requestAnimationFrame(loop);
  };
  handle = requestAnimationFrame(loop);
  return {
    backend: 'requestAnimationFrame',
    cancel: () => {
      active = false;
      if (handle) cancelAnimationFrame(handle);
    },
  };
}
