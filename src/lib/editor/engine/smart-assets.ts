import type { AssetRef } from '../document';

export type AssetFingerprint = string & { readonly __brand: 'AssetFingerprint' };

export type SmartAsset = Readonly<{
  asset: AssetRef;
  sourceId: string;
  fingerprint: AssetFingerprint;
  provenance: Readonly<{
    kind: 'source' | 'linked' | 'derived';
    parentAssetIds: readonly string[];
    operationId: string | null;
  }>;
}>;

export const createAssetFingerprint = (value: string): AssetFingerprint => {
  const normalized = value.trim();
  if (!normalized) throw new Error('ASSET_FINGERPRINT_REQUIRED');
  return normalized as AssetFingerprint;
};

export const createSmartAsset = (
  asset: AssetRef,
  fingerprint: AssetFingerprint,
  provenance: SmartAsset['provenance'],
): SmartAsset => {
  if (!asset.id.trim()) throw new Error('ASSET_IDENTITY_INVALID');
  if (provenance.kind === 'derived' && provenance.parentAssetIds.length === 0) {
    throw new Error('DERIVED_ASSET_PARENT_REQUIRED');
  }
  return Object.freeze({
    asset: Object.freeze({ ...asset }),
    sourceId: asset.id,
    fingerprint,
    provenance: Object.freeze({
      ...provenance,
      parentAssetIds: Object.freeze([...provenance.parentAssetIds]),
    }),
  });
};