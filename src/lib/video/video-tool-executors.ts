import type { CapabilityParameters } from '../agent/capability-registry';
import { renderVideoToWebm } from './video-executor';

export type VideoToolExecutor = (inputBlob: Blob, parameters: CapabilityParameters, tool: { id: string }, signal?: AbortSignal) => Promise<Blob>;

const numberOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const VIDEO_EXECUTORS: Readonly<Record<string, VideoToolExecutor>> = Object.freeze({
  'video-trimmer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    startSec: numberOr(parameters.startSec, 0),
    signal,
    endSec: parameters.endSec === undefined ? undefined : numberOr(parameters.endSec, 0),
  }),
  'video-cropper': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    crop: {
      x: Math.max(0, Math.floor(numberOr(parameters.x, 0))),
      y: Math.max(0, Math.floor(numberOr(parameters.y, 0))),
      signal,
      width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
      height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
    },
  }),
  'video-resizer': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
    height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
    fps: numberOr(parameters.fps, 30),
    signal,
  }),
  'video-compressor': (inputBlob, parameters, _tool, signal) => renderVideoToWebm(inputBlob, {
    videoBitsPerSecond: Math.floor(numberOr(parameters.videoBitsPerSecond, 2_500_000)),
    audioBitsPerSecond: Math.floor(numberOr(parameters.audioBitsPerSecond, 128_000)),
    signal,
  }),
});

export function getVideoToolExecutor(tool: { id: string }): VideoToolExecutor | undefined {
  return VIDEO_EXECUTORS[tool.id];
}
