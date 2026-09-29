import type { CanvasSpec, Document, DocumentId, AssetRef } from './types';

const freezeRecord = <T extends object>(value: T): Readonly<T> => Object.freeze({ ...value });

const freezeDocument = (document: Document): Document => Object.freeze({
  ...document,
  canvas: freezeRecord(document.canvas),
  assets: Object.freeze([...document.assets]),
  layers: Object.freeze([...document.layers]),
  metadata: freezeRecord(document.metadata),
});

export const createDocument = (
  id: DocumentId,
  canvas: CanvasSpec,
  assets: readonly AssetRef[] = [],
): Document => {
  if (!id.trim()) throw new Error('DOCUMENT_ID_REQUIRED');
  if (!Number.isInteger(canvas.width) || canvas.width < 1) throw new Error('DOCUMENT_WIDTH_INVALID');
  if (!Number.isInteger(canvas.height) || canvas.height < 1) throw new Error('DOCUMENT_HEIGHT_INVALID');
  return freezeDocument({
    schemaVersion: 1,
    id,
    version: 1,
    canvas: freezeRecord(canvas),
    assets: [...assets],
    layers: [],
    metadata: {},
  });
};

export const withDocumentVersion = (document: Document, version: number): Document => {
  if (!Number.isInteger(version) || version < document.version) {
    throw new Error('DOCUMENT_VERSION_INVALID');
  }
  return freezeDocument({ ...document, version });
};

export const stableDocumentJson = (document: Document): string => JSON.stringify(document, Object.keys(document).sort());
