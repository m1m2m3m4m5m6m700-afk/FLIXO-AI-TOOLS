"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaCanvasPropsSchema } from "@/lib/ui-contracts";
import type { ProjectState } from "@/lib/schemas/project";
import { TimelineBar } from "./timeline-bar";
import { PreviewCanvas } from "@/lib/media/preview-canvas";
import { ClientMediaExportManager } from "@/lib/media/export-manager";
import type { ExportProgress, MediaExportFormat } from "@/lib/media/export-protocol";
import { resolveFrameSync } from "@/lib/media/frame-sync";

export interface MediaCanvasProps {
  projectState?: ProjectState;
  onToggleVisibility: (layerId: string) => void;
}

const EXPORT_OPTIONS: Array<{ value: MediaExportFormat; label: string }> = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WEBM" },
  { value: "gif", label: "GIF" },
  { value: "png", label: "PNG Frame" },
  { value: "png-zip", label: "PNG ZIP" },
];

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileNameFor(format: MediaExportFormat, title: string): string {
  const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_") || "flixo-export";
  return safeTitle + "." + (format === "png-zip" ? "zip" : format);
}

export function MediaCanvas(props: MediaCanvasProps) {
  const parsed = MediaCanvasPropsSchema.parse(props);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [exportFormat, setExportFormat] = useState<MediaExportFormat>("mp4");
  const [exportState, setExportState] = useState<ExportProgress | null>(null);
  const exportManagerRef = useRef<ClientMediaExportManager | null>(null);

  useEffect(() => {
    exportManagerRef.current = new ClientMediaExportManager();
    return () => exportManagerRef.current?.dispose();
  }, []);

  const handleExport = useCallback(async () => {
    if (!parsed.projectState || !exportManagerRef.current) return;

    setExportState({
      jobId: "pending",
      phase: "queued",
      progress: 0,
      message: "Queued client-side export.",
    });

    try {
      const blob = await exportManagerRef.current.export(
        parsed.projectState,
        exportFormat,
        {
          currentTimeSec,
          onProgress: setExportState,
        },
      );
      triggerDownload(blob, fileNameFor(exportFormat, parsed.projectState.title));
      setExportState({
        jobId: "completed",
        phase: "completed",
        progress: 1,
        message: "Export ready.",
      });
    } catch (error) {
      setExportState({
        jobId: "error",
        phase: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Export failed.",
      });
    }
  }, [currentTimeSec, exportFormat, parsed.projectState]);

  if (!parsed.projectState) {
    return (
      <section className="canvas-panel" aria-label="Media canvas">
        <div className="empty-state">No active project state loaded.</div>
      </section>
    );
  }

  const state = parsed.projectState;
  const sync = resolveFrameSync(state, currentTimeSec);
  const busy =
    exportState?.phase === "rendering" ||
    exportState?.phase === "encoding" ||
    exportState?.phase === "loading-wasm";

  return (
    <section className="canvas-panel" aria-label="Media canvas">
      <header className="canvas-header">
        <div>
          <div className="kicker">MEDIA CANVAS</div>
          <div className="title">{state.title} · v{state.version}</div>
        </div>

        <div className="canvas-header-actions">
          <div className="timeline-meta">
            {state.dimensions.width}×{state.dimensions.height} · {state.dimensions.fps}fps · frame {sync.frameIndex}
          </div>

          <div className="export-controls">
            <select
              aria-label="Export format"
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as MediaExportFormat)}
              disabled={busy}
            >
              {EXPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="button export"
              onClick={() => void handleExport()}
              disabled={busy}
            >
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="canvas-main">
        <div className="preview-shell">
          <div className="preview-frame" aria-label="Live canvas preview" data-testid="media-preview">
            <PreviewCanvas projectState={state} frameIndex={sync.frameIndex} />
          </div>
        </div>

        <div className="layer-list" aria-label="Layer stack">
          {state.layers.map((layer) => (
            <div key={layer.id} className="layer-card">
              <div className="layer-card-header">
                <div>
                  <div className="layer-type">[{layer.type}]</div>
                  <div className="layer-name">{layer.name}</div>
                </div>
                <button
                  type="button"
                  className={"visibility-button " + (layer.visible ? "active" : "")}
                  onClick={() => parsed.onToggleVisibility(layer.id)}
                  aria-label={(layer.visible ? "Hide " : "Show ") + layer.name}
                >
                  {layer.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {exportState ? (
        <div className="export-status" data-testid="export-progress" aria-live="polite">
          <div className="export-status-row">
            <span>{exportState.message}</span>
            <strong>{Math.round(exportState.progress * 100)}%</strong>
          </div>
          <progress value={exportState.progress} max={1} />
        </div>
      ) : null}

      <TimelineBar
        events={state.timeline}
        durationSec={state.durationSec}
        fps={state.dimensions.fps}
        currentTimeSec={sync.timeSec}
        onSeek={(timeSec) => setCurrentTimeSec(timeSec)}
      />
    </section>
  );
}