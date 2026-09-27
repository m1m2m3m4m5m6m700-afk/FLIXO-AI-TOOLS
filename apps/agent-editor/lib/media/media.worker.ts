import JSZip from "jszip";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { ProjectStateSchema, type Layer, type ProjectState } from "../schemas/project";
import {
  ExportRequestSchema,
  type ExportProgress,
  type ExportRequest,
  type MediaExportFormat,
  type WorkerRequest,
  type WorkerResponse,
} from "./export-protocol";
import { getLayerSourceTime, getRenderableLayers } from "./frame-sync";

type WorkerMessageTarget = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const workerSelf = self as unknown as WorkerMessageTarget;

type DeviceMemoryNavigator = Navigator & { deviceMemory?: number };

let ffmpegState: FFmpeg | null = null;
let activeJobId: string | null = null;
let activeFfmpegBasePath = "/ffmpeg";
const cancelledJobs = new Set<string>();
const imageBitmapCache = new Map<string, Promise<ImageBitmap>>();
const videoSourceCache = new Map<string, string>();

function sanitizeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function emitProgress(jobId: string, phase: ExportProgress["phase"], progress: number, message: string): void {
  const response: WorkerResponse = {
    type: "progress",
    progress: {
      jobId,
      phase,
      progress: Math.max(0, Math.min(1, progress)),
      message,
    },
  };
  workerSelf.postMessage(response);
}

function throwIfCancelled(jobId: string): void {
  if (cancelledJobs.has(jobId)) throw new Error("Export cancelled.");
}

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

function getMemoryBudgetBytes(): number {
  const memory = (self.navigator as DeviceMemoryNavigator).deviceMemory;
  if (typeof memory === "number" && memory > 0) {
    return memory * 1024 * 1024 * 1024 * 0.25;
  }
  return 512 * 1024 * 1024;
}

function assertMemoryBudget(project: ProjectState, frameCount: number, format: MediaExportFormat): void {
  const frameBytes = project.dimensions.width * project.dimensions.height * 4;
  const estimatedBytes =
    format === "png-zip"
      ? frameBytes * frameCount
      : format === "png"
        ? frameBytes * 3
        : frameBytes * 8;

  if (estimatedBytes > getMemoryBudgetBytes()) {
    const mb = Math.ceil(estimatedBytes / 1024 / 1024);
    throw new Error(
      "Export requires approximately " + mb +
      " MiB of working memory, which exceeds the browser media budget.",
    );
  }
}

function mimeToExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return ".webm";
  if (normalized.includes("ogg")) return ".ogv";
  return ".mp4";
}

async function fetchBinary(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Unable to fetch media source (" + response.status + ").");
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

async function ensureFfmpegLoaded(jobId: string): Promise<FFmpeg> {
  if (ffmpegState) return ffmpegState;

  emitProgress(jobId, "loading-wasm", 0.05, "Loading FFmpeg WASM lazily in the media worker.");

  const instance = new FFmpeg();
  instance.on("progress", ({ progress }) => {
    if (activeJobId === jobId) {
      emitProgress(
        jobId,
        "encoding",
        Math.min(0.99, 0.84 + Math.max(0, Math.min(1, progress)) * 0.15),
        "FFmpeg is encoding the baked frame sequence.",
      );
    }
  });

  await instance.load({
    coreURL: activeFfmpegBasePath + "/ffmpeg-core.js",
    wasmURL: activeFfmpegBasePath + "/ffmpeg-core.wasm",
    workerURL: activeFfmpegBasePath + "/ffmpeg-core.worker.js",
  });

  ffmpegState = instance;
  return instance;
}

async function getImageBitmap(layer: Layer): Promise<ImageBitmap> {
  if (!layer.url) throw new Error('Layer "' + layer.name + '" has no source URL.');

  const cached = imageBitmapCache.get(layer.id);
  if (cached) return cached;

  const pending = fetchBinary(layer.url).then(async ({ bytes, mimeType }) => {
    return await createImageBitmap(new Blob([bytes], { type: mimeType }));
  });

  imageBitmapCache.set(layer.id, pending);
  return pending;
}

async function ensureVideoSource(layer: Layer, jobId: string): Promise<string> {
  if (!layer.url) throw new Error('Layer "' + layer.name + '" has no source URL.');

  const cached = videoSourceCache.get(layer.id);
  if (cached) return cached;

  const ffmpeg = await ensureFfmpegLoaded(jobId);
  const source = await fetchBinary(layer.url);
  const path =
    "flixo_source_" + sanitizeToken(layer.id) + mimeToExtension(source.mimeType);

  await ffmpeg.writeFile(path, source.bytes);
  videoSourceCache.set(layer.id, path);
  return path;
}

async function extractVideoFrame(
  layer: Layer,
  sourceTimeSec: number,
  jobId: string,
): Promise<ImageBitmap> {
  const ffmpeg = await ensureFfmpegLoaded(jobId);
  const sourcePath = await ensureVideoSource(layer, jobId);
  const outputPath =
    "flixo_frame_" + sanitizeToken(jobId) + "_" + sanitizeToken(layer.id) + ".png";

  await ffmpeg.exec([
    "-ss",
    sourceTimeSec.toFixed(6),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-f",
    "image2",
    outputPath,
  ]);

  const bytes = toBytes(await ffmpeg.readFile(outputPath));
  try {
    await ffmpeg.deleteFile(outputPath);
  } catch {
    // Best-effort temporary-file cleanup.
  }

  return await createImageBitmap(new Blob([bytes], { type: "image/png" }));
}

function drawText(context: OffscreenCanvasRenderingContext2D, layer: Layer): void {
  context.fillStyle = "#ffffff";
  context.font = "48px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(layer.content ?? layer.name, 0, 0);
}

async function drawLayer(
  context: OffscreenCanvasRenderingContext2D,
  project: ProjectState,
  layer: Layer,
  frameIndex: number,
  jobId: string,
): Promise<void> {
  const width = project.dimensions.width;
  const height = project.dimensions.height;

  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
  context.translate(width / 2 + layer.transform.x, height / 2 + layer.transform.y);
  context.rotate((layer.transform.rotation * Math.PI) / 180);
  context.scale(layer.transform.scaleX, layer.transform.scaleY);

  if (layer.type === "image") {
    const image = await getImageBitmap(layer);
    context.drawImage(image, -image.width / 2, -image.height / 2);
  } else if (layer.type === "video") {
    const sourceTime = getLayerSourceTime(layer, frameIndex, project.dimensions.fps);
    const image = await extractVideoFrame(layer, sourceTime, jobId);
    context.drawImage(image, -image.width / 2, -image.height / 2);
    image.close();
  } else if (layer.type === "text") {
    drawText(context, layer);
  }

  context.restore();
}

function applyColorLut(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  lutName: string,
): void {
  if (lutName === "identity") return;

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;

    if (lutName === "cinematic_warm") {
      data[index] = Math.min(255, Math.round(red * 1.06 + 6));
      data[index + 1] = Math.min(255, Math.round(green * 1.01 + 2));
      data[index + 2] = Math.min(255, Math.round(blue * 0.90));
    } else if (lutName === "cool") {
      data[index] = Math.min(255, Math.round(red * 0.92));
      data[index + 1] = Math.min(255, Math.round(green * 1.01));
      data[index + 2] = Math.min(255, Math.round(blue * 1.08));
    } else if (lutName === "monochrome") {
      const luminance = Math.round(
        red * 0.2126 + green * 0.7152 + blue * 0.0722,
      );
      data[index] = luminance;
      data[index + 1] = luminance;
      data[index + 2] = luminance;
    }
  }

  context.putImageData(image, 0, 0);
}

async function renderFrame(project: ProjectState, frameIndex: number, jobId: string): Promise<Blob> {
  throwIfCancelled(jobId);

  const canvas = new OffscreenCanvas(project.dimensions.width, project.dimensions.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OffscreenCanvas 2D context is unavailable.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const layers = getRenderableLayers(project, frameIndex);
  for (const layer of layers) {
    throwIfCancelled(jobId);
    await drawLayer(context, project, layer, frameIndex, jobId);
  }

  const lutLayer = layers.find(
    (layer) =>
      typeof layer.metadata.appliedLut === "string" &&
      layer.metadata.appliedLut.length > 0,
  );

  if (lutLayer && typeof lutLayer.metadata.appliedLut === "string") {
    applyColorLut(
      context,
      canvas.width,
      canvas.height,
      lutLayer.metadata.appliedLut,
    );
  }

  return await canvas.convertToBlob({ type: "image/png" });
}

async function createZip(
  frames: Array<{ name: string; blob: Blob }>,
  project: ProjectState,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    "project.json",
    JSON.stringify(
      {
        title: project.title,
        dimensions: project.dimensions,
        durationSec: project.durationSec,
        frames: frames.length,
      },
      null,
      2,
    ),
  );

  for (const frame of frames) {
    zip.file(frame.name, frame.blob, {
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });
  }

  return await zip.generateAsync({ type: "blob" });
}

async function encodeFrames(
  ffmpeg: FFmpeg,
  project: ProjectState,
  framePaths: string[],
  format: "mp4" | "webm" | "gif",
  jobId: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const base = "flixo_export_" + sanitizeToken(jobId);
  const outputName = base + "." + format;
  const inputPattern = base + "_%06d.png";

  const codecArgs =
    format === "mp4"
      ? ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
      : format === "webm"
        ? ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32"]
        : ["-f", "gif"];

  await ffmpeg.exec([
    "-framerate",
    String(project.dimensions.fps),
    "-start_number",
    "0",
    "-i",
    inputPattern,
    ...codecArgs,
    outputName,
  ]);

  const bytes = toBytes(await ffmpeg.readFile(outputName));

  try {
    await ffmpeg.deleteFile(outputName);
  } catch {
    // Best-effort output cleanup.
  }

  for (const path of framePaths) {
    try {
      await ffmpeg.deleteFile(path);
    } catch {
      // Best-effort frame cleanup.
    }
  }

  return {
    bytes,
    mimeType:
      format === "mp4"
        ? "video/mp4"
        : format === "webm"
          ? "video/webm"
          : "image/gif",
  };
}

async function cleanupWorkerMedia(): Promise<void> {
  const promises = Array.from(imageBitmapCache.values());
  imageBitmapCache.clear();

  for (const promise of promises) {
    try {
      (await promise).close();
    } catch {
      // Best-effort bitmap cleanup.
    }
  }

  if (ffmpegState) {
    for (const path of videoSourceCache.values()) {
      try {
        await ffmpegState.deleteFile(path);
      } catch {
        // Best-effort source cleanup.
      }
    }
  }

  videoSourceCache.clear();
}

async function runExport(rawRequest: unknown): Promise<void> {
  const request = ExportRequestSchema.parse(rawRequest);
  const project = ProjectStateSchema.parse(request.project);

  activeJobId = request.jobId;
  activeFfmpegBasePath = request.ffmpegBasePath.replace(/[\\/]+$/u, "");

  const frameCount = Math.max(1, request.frameEnd - request.frameStart + 1);
  assertMemoryBudget(project, frameCount, request.format);
  emitProgress(request.jobId, "memory-check", 0.05, "Memory safety budget accepted.");

  const needsFfmpeg =
    request.format === "mp4" ||
    request.format === "webm" ||
    request.format === "gif" ||
    project.layers.some((layer) => layer.type === "video");

  if (needsFfmpeg) await ensureFfmpegLoaded(request.jobId);

  emitProgress(request.jobId, "loading-assets", 0.1, "Preparing source media.");

  const framePaths: string[] = [];
  const renderedFrames: Array<{ name: string; blob: Blob }> = [];
  const base = "flixo_export_" + sanitizeToken(request.jobId);

  try {
    for (let offset = 0; offset < frameCount; offset += 1) {
      throwIfCancelled(request.jobId);

      const frameIndex = request.frameStart + offset;
      const blob = await renderFrame(project, frameIndex, request.jobId);
      const frameName = "frame-" + String(offset + 1).padStart(6, "0") + ".png";

      if (request.format === "png") {
        const bytes = await blob.arrayBuffer();
        const response: WorkerResponse = {
          type: "complete",
          jobId: request.jobId,
          mimeType: "image/png",
          fileName: sanitizeToken(project.title) + ".png",
          buffer: bytes,
        };
        workerSelf.postMessage(response, [bytes]);
        return;
      }

      if (request.format === "png-zip") {
        renderedFrames.push({ name: frameName, blob });
      } else {
        const ffmpeg = await ensureFfmpegLoaded(request.jobId);
        const framePath = base + "_" + String(offset).padStart(6, "0") + ".png";
        await ffmpeg.writeFile(framePath, new Uint8Array(await blob.arrayBuffer()));
        framePaths.push(framePath);
      }

      emitProgress(
        request.jobId,
        "rendering",
        0.1 + ((offset + 1) / frameCount) * 0.7,
        "Rendered frame " + (offset + 1) + " of " + frameCount + ".",
      );
    }

    if (request.format === "png-zip") {
      const zip = await createZip(renderedFrames, project);
      const buffer = await zip.arrayBuffer();
      const response: WorkerResponse = {
        type: "complete",
        jobId: request.jobId,
        mimeType: "application/zip",
        fileName: sanitizeToken(project.title) + "-frames.zip",
        buffer,
      };
      workerSelf.postMessage(response, [buffer]);
      return;
    }

    const ffmpeg = await ensureFfmpegLoaded(request.jobId);
    emitProgress(
      request.jobId,
      "encoding",
      0.84,
      "Encoding the baked frame sequence in FFmpeg WASM.",
    );

    const encoded = await encodeFrames(
      ffmpeg,
      project,
      framePaths,
      request.format as "mp4" | "webm" | "gif",
      request.jobId,
    );

    const buffer = encoded.bytes.buffer.slice(
      encoded.bytes.byteOffset,
      encoded.bytes.byteOffset + encoded.bytes.byteLength,
    );
    const response: WorkerResponse = {
      type: "complete",
      jobId: request.jobId,
      mimeType: encoded.mimeType,
      fileName: sanitizeToken(project.title) + "." + request.format,
      buffer,
    };
    self.postMessage(response, [buffer]);
  } finally {
    await cleanupWorkerMedia();
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "cancel") {
    cancelledJobs.add(message.jobId);
    if (message.jobId === activeJobId && ffmpegState) {
      try {
        ffmpegState.terminate();
      } catch {
        // Best-effort worker-side FFmpeg termination.
      }
      ffmpegState = null;
    }
    return;
  }

  if (message.type !== "export") return;

  cancelledJobs.delete(message.request.jobId);

  try {
    await runExport(message.request);
    emitProgress(message.request.jobId, "completed", 1, "Media export completed.");
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown media export failure.";
    workerSelf.postMessage({
      type: "error",
      jobId: message.request.jobId,
      message: cancelledJobs.has(message.request.jobId) ? "Export cancelled." : messageText,
    } satisfies WorkerResponse);
  } finally {
    cancelledJobs.delete(message.request.jobId);
    if (activeJobId === message.request.jobId) activeJobId = null;
  }
};