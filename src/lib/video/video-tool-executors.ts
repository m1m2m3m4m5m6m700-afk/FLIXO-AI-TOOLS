import type { CapabilityParameters, ToolDefinition } from '@/config/canonical-tool-definition';
import { renderVideoToWebm } from '@/lib/video/video-executor';

export type VideoToolExecutor = (inputBlob: Blob, parameters: CapabilityParameters, tool: ToolDefinition) => Promise<Blob>;

const numberOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const VIDEO_EXECUTORS: Readonly<Record<string, VideoToolExecutor>> = Object.freeze({
  'video-trimmer': (inputBlob, parameters) => renderVideoToWebm(inputBlob, {
    startSec: numberOr(parameters.startSec, 0),
    endSec: parameters.endSec === undefined ? undefined : numberOr(parameters.endSec, 0),
  }),
  'video-cropper': (inputBlob, parameters) => renderVideoToWebm(inputBlob, {
    crop: {
      x: Math.max(0, Math.floor(numberOr(parameters.x, 0))),
      y: Math.max(0, Math.floor(numberOr(parameters.y, 0))),
      width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
      height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
    },
  }),
  'video-resizer': (inputBlob, parameters) => renderVideoToWebm(inputBlob, {
    width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
    height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
    fps: numberOr(parameters.fps, 30),
  }),
  'video-compressor': (inputBlob, parameters) => renderVideoToWebm(inputBlob, {
    videoBitsPerSecond: Math.floor(numberOr(parameters.videoBitsPerSecond, 2_500_000)),
    audioBitsPerSecond: Math.floor(numberOr(parameters.audioBitsPerSecond, 128_000)),
  }),
});

export function getVideoToolExecutor(tool: ToolDefinition): VideoToolExecutor | undefined {
  return VIDEO_EXECUTORS[tool.id];
}
