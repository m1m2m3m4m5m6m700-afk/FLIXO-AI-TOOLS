import type { DocumentCommand } from '../commands';
import type { Document } from '../document';

export type TransactionOperation = Readonly<{
  id: string;
  label: string;
  command: DocumentCommand;
  changedLayerIds: readonly string[];
}>;

export type TransactionReceipt = Readonly<{
  operationIds: readonly string[];
  previousVersion: number;
  version: number;
  changedLayerIds: readonly string[];
}>;

export const applyTransaction = (
  document: Document,
  operations: readonly TransactionOperation[],
  expectedVersion: number,
): { document: Document; receipt: TransactionReceipt } => {
  if (expectedVersion !== document.version) throw new Error('STALE_DOCUMENT_VERSION');
  if (operations.length === 0) throw new Error('EMPTY_DOCUMENT_TRANSACTION');

  const ids = new Set<string>();
  let next = document;
  const changed = new Set<string>();

  for (const operation of operations) {
    if (!operation.id.trim()) throw new Error('TRANSACTION_OPERATION_ID_REQUIRED');
    if (ids.has(operation.id)) throw new Error('DUPLICATE_OPERATION_ID');
    ids.add(operation.id);
    next = operation.command.execute({ document: next });
    for (const layerId of operation.changedLayerIds) changed.add(layerId);
  }

  const version = document.version + 1;
  const committed = Object.freeze({ ...next, version });
  return {
    document: committed,
    receipt: Object.freeze({
      operationIds: Object.freeze([...ids]),
      previousVersion: document.version,
      version,
      changedLayerIds: Object.freeze([...changed]),
    }),
  };
};

export const assertFreshDocumentVersion = (document: Document, expectedVersion: number): true => {
  if (document.version !== expectedVersion) throw new Error('STALE_DOCUMENT_VERSION');
  return true;
};