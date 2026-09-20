import type { ImageDocument, ImageRenderer } from "./types";

export class Canvas2DRenderer implements ImageRenderer {
  readonly backend = "canvas2d" as const;

  render(document: ImageDocument, target: unknown): void {
    if (!(target instanceof HTMLCanvasElement)) throw new Error("Canvas2DRenderer requires an HTMLCanvasElement");
    const context = target.getContext("2d");
    if (!context) throw new Error("Canvas2D context is unavailable");
    target.width = document.width;
    target.height = document.height;
    context.clearRect(0, 0, target.width, target.height);
  }
}

export function createImageRenderer(preferred: ImageRenderer["backend"] = "canvas2d"): ImageRenderer {
  // WebGL/WebGPU are extension points; Canvas2D is the deterministic baseline.
  if (preferred !== "canvas2d") throw new Error(`${preferred} renderer is not implemented`);
  return new Canvas2DRenderer();
}
