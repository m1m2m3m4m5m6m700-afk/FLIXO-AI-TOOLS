"use client";

import type { ProjectState } from "../schemas/project";
import type { ExportProgress, MediaExportFormat, WorkerResponse } from "./export-protocol";
import { resolveFrameSync } from "./frame-sync";

export type MediaExportOptions = Readonly<{
  currentTimeSec?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}>;

type PendingJob = Readonly<{
  resolve: (value: Blob) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (progress: ExportProgress) => void;
}>;

function createJobId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "flixo-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function assertBrowserWorkerSupport(): void {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are unavailable in this browser.");
  }
}

export class ClientMediaExportManager {
  private worker: Worker | null = null;
  private pending: PendingJob | null = null;
  private pendingJobId: string | null = null;

  private getWorker(): Worker {
    assertBrowserWorkerSupport();
    if (this.worker) return this.worker;

    this.worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleWorkerMessage(event.data);
    return this.worker;
  }

  private handleWorkerMessage(message: WorkerResponse): void {
    if (!this.pending || !this.pendingJobId) return;

    if (message.type === "progress") {
      if (message.progress.jobId === this.pendingJobId) {
        this.pending.onProgress?.(message.progress);
      }
      return;
    }

    if (message.jobId !== this.pendingJobId) return;

    const pending = this.pending;
    this.pending = null;
    this.pendingJobId = null;

    if (message.type === "complete") {
      pending.resolve(new Blob([message.buffer], { type: message.mimeType }));
    } else {
      pending.reject(new Error(message.message));
    }
  }

  async export(
    project: ProjectState,
    format: MediaExportFormat,
    options: MediaExportOptions = {},
  ): Promise<Blob> {
    if (this.pending) throw new Error("Another media export is already running.");

    const sync = resolveFrameSync(project, options.currentTimeSec ?? 0);
    const frameStart = format === "png" ? sync.frameIndex : 0;
    const frameEnd = format === "png" ? sync.frameIndex : sync.maxFrameIndex;
    const jobId = createJobId();
    const worker = this.getWorker();

    return await new Promise<Blob>((resolve, reject) => {
      this.pending = { resolve, reject, onProgress: options.onProgress };
      this.pendingJobId = jobId;

      const onAbort = () => {
        this.cancel(jobId);
        options.signal?.removeEventListener("abort", onAbort);
      };

      options.signal?.addEventListener("abort", onAbort, { once: true });

      worker.postMessage({
        type: "export",
        request: {
          jobId,
          project,
          format,
          frameStart,
          frameEnd,
          ffmpegBasePath: "/ffmpeg",
        },
      });
    });
  }

  cancel(jobId = this.pendingJobId): void {
    if (!jobId || !this.worker) return;
    this.worker.postMessage({ type: "cancel", jobId });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending = null;
    this.pendingJobId = null;
  }
}