import type { Document, Layer, LayerId, AssetRef } from '../document';
import { validateDocument } from '../document';
import type { DocumentCommand } from '../commands';
import type { DocumentEngine, DocumentEngineSnapshot, EngineOperation, EngineReceipt, LayerPatch } from './types';

const cloneDocument = (document: Document): Document => Object.freeze({
  ...document,
  canvas: Object.freeze({ ...document.canvas }),
  assets: Object.freeze(document.assets.map((asset) => Object.freeze({ ...asset }))),
  layers: Object.freeze(document.layers.map((layer) => Object.freeze({
    ...layer,
    transform: Object.freeze({ ...layer.transform }),
  }))),
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

const makeCommand = (
  id: string,
  label: string,
  apply: (document: Document) => Document,
  changedLayerIds: readonly LayerId[],
): DocumentCommand => ({
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

class TransactionalHistory {
  private readonly nodes = new Map<string, { document: Document; parentId: string | null }>();
  private currentId = 'root';
  private version = 1;

  constructor(document: Document) {
    validateDocument(document);
    this.nodes.set('root', { document: cloneDocument(document), parentId: null });
  }

  get document(): Document { return this.nodes.get(this.currentId)!.document; }
  get revision(): number { return this.version; }

  private assertVersion(expectedVersion: number): void {
    if (expectedVersion !== this.version) throw new Error('STALE_DOCUMENT_VERSION');
  }

  apply(operation: EngineOperation, changedLayerIds: readonly LayerId[]): EngineReceipt {
    this.assertVersion(operation.expectedVersion);
    const current = this.document;
    const next = operation.command.execute({ document: current });
    validateDocument(next);
    const nextVersion = this.version + 1;
    const nodeId = operation.id;
    if (this.nodes.has(nodeId)) throw new Error('DUPLICATE_OPERATION_ID');
    this.nodes.set(nodeId, { document: cloneDocument({ ...next, version: current.version + 1 }), parentId: this.currentId });
    this.currentId = nodeId;
    this.version = nextVersion;
    return Object.freeze({
      operationId: operation.id,
      label: operation.label,
      previousVersion: nextVersion - 1,
      version: nextVersion,
      changedLayerIds: Object.freeze([...changedLayerIds]),
    });
  }

  undo(): EngineReceipt | null {
    const current = this.nodes.get(this.currentId);
    if (!current || current.parentId === null) return null;
    const previousVersion = this.version;
    this.currentId = current.parentId;
    this.version += 1;
    return Object.freeze({ operationId: 'undo', label: 'Undo', previousVersion, version: this.version, changedLayerIds: Object.freeze([]) });
  }

  redo(childId?: string): EngineReceipt | null {
    const current = this.nodes.get(this.currentId);
    if (!current) throw new Error('HISTORY_CURRENT_NODE_MISSING');
    const children = [...this.nodes.entries()].filter(([, node]) => node.parentId === this.currentId);
    if (children.length === 0) return null;
    const entry = childId ? children.find(([id]) => id === childId) : children[0];
    if (!entry) throw new Error('HISTORY_CHILD_NODE_NOT_FOUND');
    const previousVersion = this.version;
    this.currentId = entry[0];
    this.version += 1;
    return Object.freeze({ operationId: 'redo', label: 'Redo', previousVersion, version: this.version, changedLayerIds: Object.freeze([]) });
  }

  canUndo(): boolean {
    return this.nodes.get(this.currentId)?.parentId !== null;
  }

  canRedo(): boolean {
    return [...this.nodes.values()].some((node) => node.parentId === this.currentId);
  }
}

export const createDocumentEngine = (document: Document): DocumentEngine => {
  const history = new TransactionalHistory(document);
  const run = (operation: EngineOperation, changedLayerIds: readonly LayerId[]): EngineReceipt => history.apply(operation, changedLayerIds);

  return {
    snapshot: (): DocumentEngineSnapshot => Object.freeze({
      document: history.document,
      version: history.revision,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
    }),

    execute: (operation) => run(operation, []),
    undo: () => history.undo(),
    redo: (childId) => history.redo(childId),

    addAsset: (asset: AssetRef, expectedVersion: number) => {
      const id = 'asset-add-' + asset.id;
      return run({
        id,
        label: 'Add asset',
        expectedVersion,
        command: makeCommand(id, 'Add asset', (document) => {
          if (document.assets.some((candidate) => candidate.id === asset.id)) throw new Error('DUPLICATE_ASSET_ID');
          return { ...document, assets: [...document.assets, Object.freeze({ ...asset })] };
        }, []),
      }, []);
    },

    addLayer: (layer: Layer, expectedVersion: number) => {
      const id = 'layer-add-' + layer.id;
      return run({
        id,
        label: 'Add layer',
        expectedVersion,
        command: makeCommand(id, 'Add layer', (document) => {
          if (document.layers.some((candidate) => candidate.id === layer.id)) throw new Error('DUPLICATE_LAYER_ID');
          return { ...document, layers: [...document.layers, Object.freeze({ ...layer, transform: Object.freeze({ ...layer.transform }) })] };
        }, [layer.id]),
      }, [layer.id]);
    },

    updateLayer: (layerId: LayerId, patch: LayerPatch, expectedVersion: number) => {
      const id = 'layer-update-' + layerId;
      return run({
        id,
        label: 'Update layer',
        expectedVersion,
        command: makeCommand(id, 'Update layer', (document) =>
          replaceLayer(document, layerId, (layer) => ({
            ...layer,
            ...patch,
            id: layer.id,
            transform: patch.transform ? Object.freeze({ ...patch.transform }) : layer.transform,
          }) as Layer), [layerId]),
      }, [layerId]);
    },

    removeLayer: (layerId: LayerId, expectedVersion: number) => {
      const id = 'layer-remove-' + layerId;
      return run({
        id,
        label: 'Remove layer',
        expectedVersion,
        command: makeCommand(id, 'Remove layer', (document) => {
          if (!document.layers.some((layer) => layer.id === layerId)) throw new Error('LAYER_NOT_FOUND');
          return { ...document, layers: document.layers.filter((layer) => layer.id !== layerId) };
        }, [layerId]),
      }, [layerId]);
    },

    reorderLayer: (layerId: LayerId, zIndex: number, expectedVersion: number) => {
      if (!Number.isInteger(zIndex)) throw new Error('LAYER_Z_INDEX_INVALID');
      const id = 'layer-reorder-' + layerId;
      return run({
        id,
        label: 'Reorder layer',
        expectedVersion,
        command: makeCommand(id, 'Reorder layer', (document) =>
          replaceLayer(document, layerId, (layer) => ({ ...layer, zIndex })), [layerId]),
      }, [layerId]);
    },
  };
};