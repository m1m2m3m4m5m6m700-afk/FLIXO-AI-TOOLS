import { z } from "zod";
import type { ProjectState } from "../schemas/project";

export const MediaExportFormatSchema = z.enum(["mp4", "webm", "gif", "png", "png-zip"]);
export type MediaExportFormat = z.infer<typeof MediaExportFormatSchema>;

export const ExportRequestSchema = z.object({
  jobId: z.string().min(1),
  project: z.unknown(),
  format: MediaExportFormatSchema,
  frameStart: z.number().int().nonnegative(),
  frameEnd: z.number().int().nonnegative(),
  ffmpegBasePath: z.string().min(1).default("/ffmpeg"),
});

export type ExportRequest = Omit<z.infer<typeof ExportRequestSchema>, "project"> & {
  project: ProjectState;
};

export type ExportPhase =
  | "queued"
  | "memory-check"
  | "loading-assets"
  | "loading-wasm"
  | "rendering"
  | "encoding"
  | "completed"
  | "cancelled"
  | "error";

export type ExportProgress = Readonly<{
  jobId: string;
  phase: ExportPhase;
  progress: number;
  message: string;
}>;

export type WorkerRequest =
  | { type: "export"; request: ExportRequest }
  | { type: "cancel"; jobId: string };

export type WorkerResponse =
  | { type: "progress"; progress: ExportProgress }
  | {
      type: "complete";
      jobId: string;
      mimeType: string;
      fileName: string;
      buffer: ArrayBuffer;
    }
  | { type: "error"; jobId: string; message: string };