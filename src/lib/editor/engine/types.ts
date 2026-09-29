import type { Document, Layer, LayerId, AssetRef } from '../document';
import type { DocumentCommand } from '../commands';

export type EngineOperation = Readonly<{
  id: string;
  label: string;
  expectedVersion: number;
  command: DocumentCommand;
}>;

export type EngineReceipt = Readonly<{
  operationId: string;
  label: string;
  previousVersion: number;
  version: number;
  changedLayerIds: readonly LayerId[];
}>;

export type DocumentEngineSnapshot = Readonly<{
  document: Document;
  version: number;
  canUndo: boolean;
  canRedo: boolean;
}>;

export type LayerPatch = Readonly<Partial<Layer>>;
export type AssetInput = Readonly<AssetRef>;

export type DocumentEngine = Readonly<{
  snapshot(): DocumentEngineSnapshot;
  execute(operation: EngineOperation): EngineReceipt;
  undo(): EngineReceipt | null;
  redo(childId?: string): EngineReceipt | null;
  addAsset(asset: AssetInput, expectedVersion: number): EngineReceipt;
  addLayer(layer: Layer, expectedVersion: number): EngineReceipt;
  updateLayer(layerId: LayerId, patch: LayerPatch, expectedVersion: number): EngineReceipt;
  removeLayer(layerId: LayerId, expectedVersion: number): EngineReceipt;
  reorderLayer(layerId: LayerId, zIndex: number, expectedVersion: number): EngineReceipt;
}>;