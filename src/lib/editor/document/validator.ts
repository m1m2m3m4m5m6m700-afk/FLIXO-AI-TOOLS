import type { Document, Layer } from './types';

const finite = (value: number): boolean => Number.isFinite(value);

const validateLayerBase = (layer: Layer): void => {
  if (!layer.id.trim()) throw new Error('LAYER_ID_REQUIRED');
  if (!layer.name.trim()) throw new Error('LAYER_NAME_REQUIRED');
  if (layer.opacity < 0 || layer.opacity > 1 || !finite(layer.opacity)) throw new Error('LAYER_OPACITY_INVALID');
  if (!Number.isInteger(layer.zIndex)) throw new Error('LAYER_Z_INDEX_INVALID');
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
  for (const layer of document.layers) {
    validateLayerBase(layer);
    if (layerIds.has(layer.id)) throw new Error('DUPLICATE_LAYER_ID');
    layerIds.add(layer.id);
    if (layer.type === 'raster' && !assetIds.has(layer.assetId)) throw new Error('RASTER_ASSET_MISSING');
  }

  for (const layer of document.layers) {
    if (layer.parentId !== null && !layerIds.has(layer.parentId)) throw new Error('LAYER_PARENT_MISSING');
    if (layer.maskId !== null && !layerIds.has(layer.maskId)) throw new Error('LAYER_MASK_MISSING');
  }

  return true;
};
