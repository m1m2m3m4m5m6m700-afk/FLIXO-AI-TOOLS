export type ImageLayerType =
  | "raster"
  | "text"
  | "shape"
  | "adjustment"
  | "smart-object"
  | "ai-result";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "darken"
  | "lighten";

export interface ImageTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface ImageMask {
  id: string;
  enabled: boolean;
  inverted: boolean;
  feather: number;
  opacity: number;
}

export interface ImageSelection {
  id: string;
  kind: "rectangle" | "ellipse" | "freehand" | "polygon" | "brush" | "subject" | "ai";
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ImageLayer {
  id: string;
  type: ImageLayerType;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: ImageTransform;
  sourceId?: string;
  mask?: ImageMask;
  payload?: unknown;
}

export interface ImageDocument {
  id: string;
  width: number;
  height: number;
  colorSpace: "srgb";
  background: "transparent" | "opaque";
  layers: ImageLayer[];
  selections: ImageSelection[];
  metadata: Record<string, string>;
}

export interface ImageCommand {
  readonly type: string;
  execute(document: ImageDocument): ImageDocument;
  undo(document: ImageDocument): ImageDocument;
}

export interface ImageRenderer {
  readonly backend: "canvas2d" | "webgl" | "webgpu";
  render(document: ImageDocument, target: unknown): void;
}

export type ImageCapability =
  | "layers"
  | "masks"
  | "selections"
  | "crop"
  | "resize"
  | "filters"
  | "upscale"
  | "object-removal"
  | "background-removal"
  | "ai-generation"
  | "export"
  | "batch";
