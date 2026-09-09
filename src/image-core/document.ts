import type { ImageDocument, ImageLayer, ImageSelection } from "./types";

const defaultTransform = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

export function createImageDocument(input: Pick<ImageDocument, "id" | "width" | "height">): ImageDocument {
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
  return { ...document, layers: [...document.layers, { ...layer, transform: layer.transform ?? defaultTransform() }] };
}

export function removeLayer(document: ImageDocument, layerId: string): ImageDocument {
  return { ...document, layers: document.layers.filter((layer) => layer.id !== layerId) };
}

export function updateLayer(document: ImageDocument, layerId: string, patch: Partial<ImageLayer>): ImageDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch, id: layer.id } : layer)),
  };
}

export function setSelections(document: ImageDocument, selections: ImageSelection[]): ImageDocument {
  return { ...document, selections: [...selections] };
}
