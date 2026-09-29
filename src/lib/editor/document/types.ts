export type DocumentId = string;
export type AssetId = string;
export type LayerId = string;
export type GroupId = string;

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'darken'
  | 'lighten';

export type LayerType =
  | 'raster'
  | 'adjustment'
  | 'mask'
  | 'text'
  | 'vector'
  | 'generated'
  | 'group';

export type Transform = Readonly<{
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}>;

export type CanvasSpec = Readonly<{
  width: number;
  height: number;
  colorSpace: 'srgb' | 'display-p3' | 'adobe-rgb';
  bitDepth: 8 | 16;
  alpha: 'straight' | 'premultiplied';
}>;

export type AssetRef = Readonly<{
  id: AssetId;
  kind: 'source' | 'generated' | 'linked';
  name: string;
  mimeType: string;
  width: number;
  height: number;
}>;

export type LayerBase = Readonly<{
  id: LayerId;
  type: LayerType;
  name: string;
  parentId: GroupId | null;
  zIndex: number;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: Transform;
  clipToBelow: boolean;
  maskId: LayerId | null;
}>;

export type RasterLayer = LayerBase & Readonly<{
  type: 'raster';
  assetId: AssetId;
}>;

export type AdjustmentLayer = LayerBase & Readonly<{
  type: 'adjustment';
  operation: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
}>;

export type MaskLayer = LayerBase & Readonly<{
  type: 'mask';
  source: 'raster' | 'brush' | 'linear' | 'radial' | 'polygon' | 'subject' | 'sky' | 'depth' | 'composite';
}>;

export type TextLayer = LayerBase & Readonly<{
  type: 'text';
  text: string;
}>;

export type VectorLayer = LayerBase & Readonly<{
  type: 'vector';
  pathData: string;
}>;

export type GeneratedLayer = LayerBase & Readonly<{
  type: 'generated';
  generator: string;
}>;

export type GroupLayer = LayerBase & Readonly<{
  type: 'group';
  childIds: readonly LayerId[];
}>;

export type Layer =
  | RasterLayer
  | AdjustmentLayer
  | MaskLayer
  | TextLayer
  | VectorLayer
  | GeneratedLayer
  | GroupLayer;

export type Document = Readonly<{
  schemaVersion: 1;
  id: DocumentId;
  version: number;
  canvas: CanvasSpec;
  assets: readonly AssetRef[];
  layers: readonly Layer[];
  metadata: Readonly<Record<string, string>>;
}>;
