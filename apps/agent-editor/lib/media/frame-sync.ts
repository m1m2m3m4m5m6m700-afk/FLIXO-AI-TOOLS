import type { Layer, ProjectState } from "../schemas/project";

export type FrameSync = Readonly<{
  frameIndex: number;
  timeSec: number;
  maxFrameIndex: number;
}>;

export function getMaxFrameIndex(project: Pick<ProjectState, "durationSec" | "dimensions">): number {
  if (project.durationSec <= 0) return 0;
  return Math.max(0, Math.ceil(project.durationSec * project.dimensions.fps) - 1);
}

export function clampFrameIndex(frameIndex: number, maxFrameIndex: number): number {
  if (!Number.isFinite(frameIndex)) return 0;
  return Math.min(maxFrameIndex, Math.max(0, Math.trunc(frameIndex)));
}

export function frameToTime(frameIndex: number, fps: number): number {
  if (fps <= 0) return 0;
  return clampFrameIndex(frameIndex, Number.MAX_SAFE_INTEGER) / fps;
}

export function timeToFrame(timeSec: number, fps: number, maxFrameIndex: number): number {
  if (fps <= 0) return 0;
  return clampFrameIndex(Math.round(Math.max(0, timeSec) * fps), maxFrameIndex);
}

export function resolveFrameSync(
  project: Pick<ProjectState, "durationSec" | "dimensions">,
  timeSec: number,
): FrameSync {
  const maxFrameIndex = getMaxFrameIndex(project);
  const frameIndex = timeToFrame(timeSec, project.dimensions.fps, maxFrameIndex);
  return {
    frameIndex,
    timeSec: frameToTime(frameIndex, project.dimensions.fps),
    maxFrameIndex,
  };
}

export function isLayerActiveAtFrame(layer: Layer, frameIndex: number, fps: number): boolean {
  if (!layer.visible) return false;
  if (!layer.timeframe) return true;

  const timeSec = frameToTime(frameIndex, fps);
  return timeSec >= layer.timeframe.startTimeSec && timeSec < layer.timeframe.endTimeSec;
}

export function getLayerSourceTime(layer: Layer, frameIndex: number, fps: number): number {
  const timelineTimeSec = frameToTime(frameIndex, fps);
  if (!layer.timeframe) return timelineTimeSec;

  const relativeTime = Math.max(0, timelineTimeSec - layer.timeframe.startTimeSec);
  const sourceTime = layer.timeframe.trimStartSec + relativeTime;

  if (layer.timeframe.trimEndSec > layer.timeframe.trimStartSec) {
    return Math.min(sourceTime, layer.timeframe.trimEndSec);
  }

  return sourceTime;
}

export function getRenderableLayers(project: ProjectState, frameIndex: number): Layer[] {
  return project.layers
    .filter((layer) => isLayerActiveAtFrame(layer, frameIndex, project.dimensions.fps))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex);
}