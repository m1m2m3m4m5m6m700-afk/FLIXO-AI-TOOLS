"use client";

import { MediaCanvasPropsSchema } from "@/lib/ui-contracts";
import type { Layer, ProjectState } from "@/lib/schemas/project";
import { TimelineBar } from "./timeline-bar";

export interface MediaCanvasProps {
  projectState?: ProjectState;
  onToggleVisibility: (layerId: string) => void;
}

function renderLayer(layer: Layer) {
  if (!layer.visible) return null;

  if (layer.type === "image" && layer.url) {
    return <img key={layer.id} src={layer.url} alt={layer.name} style={{ opacity: layer.opacity }} />;
  }
  if (layer.type === "video" && layer.url) {
    return <video key={layer.id} src={layer.url} controls style={{ opacity: layer.opacity }} />;
  }
  if (layer.type === "text") {
    return <div key={layer.id} style={{ opacity: layer.opacity, padding: 20 }}>{layer.content ?? layer.name}</div>;
  }
  if (layer.type === "audio" && layer.url) {
    return <audio key={layer.id} src={layer.url} controls />;
  }
  return null;
}

export function MediaCanvas(props: MediaCanvasProps) {
  const parsed = MediaCanvasPropsSchema.parse(props);

  if (!parsed.projectState) {
    return (
      <section className="canvas-panel" aria-label="Media canvas">
        <div className="empty-state">No active project state loaded.</div>
      </section>
    );
  }

  const state = parsed.projectState;
  return (
    <section className="canvas-panel" aria-label="Media canvas">
      <header className="canvas-header">
        <div>
          <div className="kicker">MEDIA CANVAS</div>
          <div className="title">{state.title} · v{state.version}</div>
        </div>
        <div className="timeline-meta">
          {state.dimensions.width}×{state.dimensions.height} · {state.dimensions.fps}fps · {state.layers.length} layers
        </div>
      </header>

      <div className="canvas-main">
        <div className="preview-shell">
          <div className="preview-frame" aria-label="Live canvas preview" data-testid="media-preview">
            {state.layers.length === 0
              ? <div className="empty-state">Canvas Empty</div>
              : state.layers.slice().sort((a, b) => a.transform.zIndex - b.transform.zIndex).map(renderLayer)}
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

      <TimelineBar events={state.timeline} />
    </section>
  );
}
