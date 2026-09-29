import type { Document, Layer, LayerId, AssetRef } from '../document';
import { validateDocument } from '../document';
import { createHistory, currentDocument, executeCommand, redo, undo, type HistoryState } from '../commands/history';
import type { DocumentCommand } from '../commands';
import type { DocumentEngine, DocumentEngineSnapshot, EngineOperation, EngineReceipt, LayerPatch } from './types';

const cloneDocument = (document: Document): Document => Object.freeze({
  ...document,
  canvas: Object.freeze({ ...document.canvas }),
  assets: Object.freeze(document.assets.map((asset) => Object.freeze({ ...asset }))),
  layers: Object.freeze(document.layers.map((layer) => Object.freeze({ ...layer, transform: Object.freeze({ ...layer.transform }) }))),
  metadata: Object.freeze({ ...document.metadata }),
});

const replaceLayer = (document: Document, layerId: LayerId, transform: (layer: Layer) => Layer): Document => {
  let found = false;
  const layers = document.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    found = true;
    return transform(layer);
  });
  if (!found) throw new Error('LAYER_NOT_FOUND');
  return cloneDocument({ ...document, layers });
};

const command = (id: string, label: string, apply: (document: Document) => Document, changedLayerIds: readonly LayerId[]): DocumentCommand => ({
  id,
  label,
  execute: ({ document }) => {
    const next = apply(document);
    validateDocument(next);
    return cloneDocument(next);
  },
  undo: ({ document }) => document,
  serialize: () => ({ id, label, changedLayerIds }),
});

class EngineCommandHistory {
  private readonly root: Document;
  private state: HistoryState;

  constructor(document: Document) {
    this.root = document;
    this.state = createHistory(document, 'root');
  }

  get current(): Document { return currentDocument(this.state); }
  get canUndo(): boolean { return this.state.currentId !== this.state.rootId; }
  get canRedo(): boolean {
    return [...this.state.nodes.values()].some((node) => node.parentId === this.state.currentId);
  }

  apply(operation: EngineOperation, changedLayerIds: readonly LayerId[]): EngineReceipt {
    const current = this.current;
    if (operation.expectedVersion !== current.version) throw new Error('STALE_DOCUMENT_VERSION');
    const next = operation.command.execute({ document: current });
    const versioned = cloneDocument({ ...next, version: current.version + 1 });
    validateDocument(versioned);
    this.state = executeCommand(
      this.state,
      {
        ...operation.command,
        execute: () => versioned,
        undo: () => current,
      },
      operation.id,
    );
    return Object.freeze({
      operationId: operation.id,
      label: operation.label,
      previousVersion: current.version,
      version: versioned.version,
      changedLayerIds: Object.freeze([...changedLayerIds]),
    });
  }

  stepUndo(): EngineReceipt | null {
    if (!this.canUndo) return null;
    const before = this.current;
    this.state = undo(this.state);
    const after = this.current;
    return Object.freeze({ operationId: 'undo', label: 'Undo', previousVersion: before.version, version: after.version, changedLayerIds: Object.freeze([]) });
  }

  stepRedo(childId?: string): EngineReceipt | null {
    if (!this.canRedo) return null;
    const before = this.current;
    this.state = redo(this.state, childId);
    const after = this.current;
    return Object.freeze({ operationId: 'redo', label: 'Redo', previousVersion: before.version, version: after.version, changedLayerIds: Object.freeze([]) });
  }
}

export const createDocumentEngine = (document: Document): DocumentEngine => {
  validateDocument(document);
  const history = new EngineCommandHistory(cloneDocument(document));

  const run = (operation: EngineOperation, changedLayerIds: readonly LayerId[]): EngineReceipt =>
    history.apply(operation, changedLayerIds);

  return {
    snapshot: (): DocumentEngineSnapshot => Object.freeze({
      document: history.current,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    }),

    execute: (operation) => run(operation, []),

    undo: () => history.stepUndo(),
    redo: (childId) => history.stepRedo(childId),

    addAsset: (asset: AssetRef, expectedVersion: number) => {
      const id = 'asset-add-' + asset.id;
      const operation: EngineOperation = {
        id,
        label: 'Add asset',
        expectedVersion,
        command: command(id, 'Add asset', (document) => {
          if (document.assets.some((candidate) => candidate.id === asset.id)) throw new Error('DUPLICATE_ASSET_ID');
          return { ...document, assets: [...document.assets, Object.freeze({ ...asset })] };
        }, []),
      };
      return run(operation, []);
    },

    addLayer: (layer: Layer, expectedVersion: number) => {
      const operation: EngineOperation = {
        id: 'layer-add-' + layer.id,
        label: 'Add layer',
        expectedVersion,
        command: command('layer-add-' + layer.id, 'Add layer', (document) => {
          if (document.layers.some((candidate) => candidate.id === layer.id)) throw new Error('DUPLICATE_LAYER_ID');
          return { ...document, layers: [...document.layers, Object.freeze({ ...layer, transform: Object.freeze({ ...layer.transform }) })] };
        }, [layer.id]),
      };
      return run(operation, [layer.id]);
    },

    updateLayer: (layerId: LayerId, patch: LayerPatch, expectedVersion: number) => {
      const operation: EngineOperation = {
        id: 'layer-update-' + layerId,
        label: 'Update layer',
        expectedVersion,
        command: command('layer-update-' + layerId, 'Update layer', (document) =>
          replaceLayer(document, layerId, (layer) => ({ ...layer, ...patch, id: layer.id, transform: patch.transform ? Object.freeze({ ...patch.transform }) : layer.transform })), [layerId]),
      };
      return run(operation, [layerId]);
    },

    removeLayer: (layerId: LayerId, expectedVersion: number) => {
      const operation: EngineOperation = {
        id: 'layer-remove-' + layerId,
        label: 'Remove layer',
        expectedVersion,
        command: command('layer-remove-' + layerId, 'Remove layer', (document) => {
          if (!document.layers.some((layer) => layer.id === layerId)) throw new Error('LAYER_NOT_FOUND');
          return { ...document, layers: document.layers.filter((layer) => layer.id !== layerId) };
        }, [layerId]),
      };
      return run(operation, [layerId]);
    },

    reorderLayer: (layerId: LayerId, zIndex: number, expectedVersion: number) => {
      if (!Number.isInteger(zIndex)) throw new Error('LAYER_Z_INDEX_INVALID');
      const operation: EngineOperation = {
        id: 'layer-reorder-' + layerId,
        label: 'Reorder layer',
        expectedVersion,
        command: command('layer-reorder-' + layerId, 'Reorder layer', (document) =>
          replaceLayer(document, layerId, (layer) => ({ ...layer, zIndex })), [layerId]),
      };
      return run(operation, [layerId]);
    },
  };
};