import type { Document, Layer } from './types';

const finite = (value: number): boolean => Number.isFinite(value);

const validateLayerBase = (layer: Layer): void => {
  if (!layer.id.trim()) throw new Error('LAYER_ID_REQUIRED');
  if (!layer.name.trim()) throw new Error('LAYER_NAME_REQUIRED');
  if (layer.opacity < 0 || layer.opacity > 1 || !finite(layer.opacity)) throw new Error('LAYER_OPACITY_INVALID');
  if (!Number.isInteger(layer.zIndex)) throw new Error('LAYER_Z_INDEX_INVALID');
  if (typeof layer.visible !== 'boolean' || typeof layer.clipToBelow !== 'boolean') throw new Error('LAYER_BOOLEAN_FIELD_INVALID');
  if (!finite(layer.transform.x) || !finite(layer.transform.y) || !finite(layer.transform.scaleX) || !finite(layer.transform.scaleY) || !finite(layer.transform.rotation)) {
    throw new Error('LAYER_TRANSFORM_INVALID');
  }
};

export const validateDocument = (document: Document): true => {
  if (document.schemaVersion !== 1) throw new Error('DOCUMENT_SCHEMA_UNSUPPORTED');
  if (!document.id.trim()) throw new Error('DOCUMENT_ID_REQUIRED');
  if (!Number.isInteger(document.version) || document.version < 1) throw new Error('DOCUMENT_VERSION_INVALID');
  if (!Number.isInteger(document.canvas.width) || document.canvas.width < 1) throw new Error('DOCUMENT_WIDTH_INVALID');
  if (!Number.isInteger(document.canvas.height) || document.canvas.height < 1) throw new Error('DOCUMENT_HEIGHT_INVALID');

  const assetIds = new Set<string>();
  for (const asset of document.assets) {
    if (assetIds.has(asset.id)) throw new Error('DUPLICATE_ASSET_ID');
    assetIds.add(asset.id);
    if (!asset.id.trim() || !asset.name.trim() || !asset.mimeType.trim()) throw new Error('ASSET_IDENTITY_INVALID');
    if (!Number.isInteger(asset.width) || asset.width < 1 || !Number.isInteger(asset.height) || asset.height < 1) {
      throw new Error('ASSET_DIMENSIONS_INVALID');
    }
  }

  const layerIds = new Set<string>();
  const layersById = new Map<string, Layer>();
  for (const layer of document.layers) {
    validateLayerBase(layer);
    if (layerIds.has(layer.id)) throw new Error('DUPLICATE_LAYER_ID');
    layerIds.add(layer.id);
    layersById.set(layer.id, layer);
    if (layer.type === 'raster' && !assetIds.has(layer.assetId)) throw new Error('RASTER_ASSET_MISSING');
  }

  for (const layer of document.layers) {
    if (layer.parentId !== null) {
      const parent = layersById.get(layer.parentId);
      if (!parent) throw new Error('LAYER_PARENT_MISSING');
      if (parent.type !== 'group') throw new Error('LAYER_PARENT_NOT_GROUP');
      if (layer.parentId === layer.id) throw new Error('LAYER_SELF_PARENT');
    }

    if (layer.maskId !== null) {
      const mask = layersById.get(layer.maskId);
      if (!mask) throw new Error('LAYER_MASK_MISSING');
      if (mask.type !== 'mask') throw new Error('LAYER_MASK_NOT_MASK');
      if (layer.maskId === layer.id) throw new Error('LAYER_SELF_MASK');
    }

    if (layer.type === 'group') {
      const childIds = new Set<string>();
      for (const childId of layer.childIds) {
        if (childIds.has(childId)) throw new Error('DUPLICATE_GROUP_CHILD_ID');
        childIds.add(childId);
        if (childId === layer.id) throw new Error('GROUP_SELF_CHILD');
        const child = layersById.get(childId);
        if (!child) throw new Error('GROUP_CHILD_MISSING');
        if (child.parentId !== layer.id) throw new Error('GROUP_CHILD_PARENT_MISMATCH');
      }
    }
  }

  for (const layer of document.layers) {
    const seen = new Set<string>();
    let current: Layer | undefined = layer;
    while (current?.parentId !== null && current?.parentId !== undefined) {
      if (seen.has(current.id)) throw new Error('LAYER_PARENT_CYCLE');
      seen.add(current.id);
      current = layersById.get(current.parentId);
      if (!current) throw new Error('LAYER_PARENT_MISSING');
    }
  }

  return true;
};
