import type { ImageDocument, ImageLayer, ImageSelection } from "./types";

const LAYER_TYPES: readonly ImageLayer["type"][] = ["raster", "text", "shape", "adjustment", "smart-object", "ai-result"];
const BLEND_MODES: readonly ImageLayer["blendMode"][] = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "darken", "lighten"];
const SELECTION_KINDS: readonly ImageSelection["kind"][] = ["rectangle", "ellipse", "freehand", "polygon", "brush", "subject", "ai"];

const defaultTransform = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
}

function assertTransform(transform: unknown): asserts transform is ImageLayer["transform"] {
  if (!transform || typeof transform !== "object") throw new Error("Layer transform is required");
  const value = transform as Record<string, unknown>;
  for (const key of ["x", "y", "scaleX", "scaleY", "rotation"]) assertFiniteNumber(value[key], `Layer transform ${key}`);
  if (value.scaleX === 0 || value.scaleY === 0) throw new Error("Layer transform scale cannot be zero");
}

function assertLayer(layer: ImageLayer): void {
  assertString(layer.id, "Layer id");
  assertString(layer.name, "Layer name");
  if (!LAYER_TYPES.includes(layer.type)) throw new Error(`Unsupported layer type: ${String(layer.type)}`);
  if (typeof layer.visible !== "boolean") throw new Error("Layer visible must be a boolean");
  assertFiniteNumber(layer.opacity, "Layer opacity");
  if (layer.opacity < 0 || layer.opacity > 1) throw new Error("Layer opacity must be between 0 and 1");
  if (!BLEND_MODES.includes(layer.blendMode)) throw new Error(`Unsupported blend mode: ${String(layer.blendMode)}`);
  assertTransform(layer.transform);
  if (layer.sourceId !== undefined) assertString(layer.sourceId, "Layer sourceId");
  if (layer.mask) {
    assertString(layer.mask.id, "Mask id");
    if (typeof layer.mask.enabled !== "boolean" || typeof layer.mask.inverted !== "boolean") throw new Error("Mask enabled/inverted must be boolean");
    assertFiniteNumber(layer.mask.feather, "Mask feather");
    if (layer.mask.feather < 0) throw new Error("Mask feather must be non-negative");
    assertFiniteNumber(layer.mask.opacity, "Mask opacity");
    if (layer.mask.opacity < 0 || layer.mask.opacity > 1) throw new Error("Mask opacity must be between 0 and 1");
  }
}

function assertSelection(selection: ImageSelection): void {
  assertString(selection.id, "Selection id");
  if (!SELECTION_KINDS.includes(selection.kind)) throw new Error(`Unsupported selection kind: ${String(selection.kind)}`);
  const bounds = selection.bounds;
  if (!bounds || typeof bounds !== "object") throw new Error("Selection bounds are required");
  assertFiniteNumber(bounds.x, "Selection bounds x");
  assertFiniteNumber(bounds.y, "Selection bounds y");
  assertFiniteNumber(bounds.width, "Selection bounds width");
  assertFiniteNumber(bounds.height, "Selection bounds height");
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error("Selection bounds width/height must be positive");
}

export function createImageDocument(input: Pick<ImageDocument, "id" | "width" | "height">): ImageDocument {
  assertString(input.id, "Document id");
  if (!Number.isInteger(input.width) || input.width <= 0) throw new Error("Image width must be a positive integer");
  if (!Number.isInteger(input.height) || input.height <= 0) throw new Error("Image height must be a positive integer");
  return {
    ...input,
    colorSpace: "srgb",
    background: "transparent",
    layers: [],
    selections: [],
    metadata: {},
  };
}

export function addLayer(document: ImageDocument, layer: Omit<ImageLayer, "transform"> & Partial<Pick<ImageLayer, "transform">>): ImageDocument {
  const nextLayer: ImageLayer = { ...layer, transform: layer.transform ?? defaultTransform() };
  assertLayer(nextLayer);
  if (document.layers.some((existing) => existing.id === nextLayer.id)) throw new Error(`Layer id already exists: ${nextLayer.id}`);
  return { ...document, layers: [...document.layers, nextLayer] };
}

export function removeLayer(document: ImageDocument, layerId: string): ImageDocument {
  assertString(layerId, "Layer id");
  return { ...document, layers: document.layers.filter((layer) => layer.id !== layerId) };
}

export function updateLayer(document: ImageDocument, layerId: string, patch: Partial<ImageLayer>): ImageDocument {
  assertString(layerId, "Layer id");
  const existing = document.layers.find((layer) => layer.id === layerId);
  if (!existing) throw new Error(`Layer not found: ${layerId}`);
  const nextLayer = { ...existing, ...patch, id: existing.id };
  assertLayer(nextLayer);
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? nextLayer : layer)),
  };
}

export function setSelections(document: ImageDocument, selections: ImageSelection[]): ImageDocument {
  for (const selection of selections) assertSelection(selection);
  const ids = new Set<string>();
  for (const selection of selections) {
    if (ids.has(selection.id)) throw new Error(`Selection id already exists: ${selection.id}`);
    ids.add(selection.id);
  }
  return { ...document, selections: selections.map((selection) => ({ ...selection, bounds: { ...selection.bounds } })) };
}
