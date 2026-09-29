import type { Document } from '../document';
import type { DocumentCommand } from './command';

export type HistoryNode = Readonly<{
  id: string;
  parentId: string | null;
  command: DocumentCommand | null;
  document: Document;
}>;

export type HistoryState = Readonly<{
  rootId: string;
  currentId: string;
  nodes: ReadonlyMap<string, HistoryNode>;
}>;

const copyNodes = (nodes: ReadonlyMap<string, HistoryNode>): Map<string, HistoryNode> => new Map(nodes);

export const createHistory = (document: Document, rootId = 'root'): HistoryState => {
  const root: HistoryNode = Object.freeze({ id: rootId, parentId: null, command: null, document });
  return Object.freeze({
    rootId,
    currentId: rootId,
    nodes: new Map([[rootId, root]]),
  });
};

export const executeCommand = (state: HistoryState, command: DocumentCommand, nodeId: string): HistoryState => {
  if (!nodeId.trim()) throw new Error('HISTORY_NODE_ID_REQUIRED');
  const current = state.nodes.get(state.currentId);
  if (!current) throw new Error('HISTORY_CURRENT_NODE_MISSING');
  const nextDocument = command.execute({ document: current.document });
  const nodes = copyNodes(state.nodes);
  nodes.set(nodeId, Object.freeze({
    id: nodeId,
    parentId: current.id,
    command,
    document: nextDocument,
  }));
  return Object.freeze({ ...state, currentId: nodeId, nodes });
};

export const undo = (state: HistoryState): HistoryState => {
  const current = state.nodes.get(state.currentId);
  if (!current) throw new Error('HISTORY_CURRENT_NODE_MISSING');
  if (current.parentId === null) return state;
  const parent = state.nodes.get(current.parentId);
  if (!parent) throw new Error('HISTORY_PARENT_NODE_MISSING');
  return Object.freeze({ ...state, currentId: parent.id });
};

export const redo = (state: HistoryState, childId?: string): HistoryState => {
  const current = state.nodes.get(state.currentId);
  if (!current) throw new Error('HISTORY_CURRENT_NODE_MISSING');
  const children = [...state.nodes.values()].filter((node) => node.parentId === current.id);
  if (children.length === 0) return state;
  const child = childId ? children.find((candidate) => candidate.id === childId) : children[0];
  if (!child) throw new Error('HISTORY_CHILD_NODE_NOT_FOUND');
  return Object.freeze({ ...state, currentId: child.id });
};

export const currentDocument = (state: HistoryState): Document => {
  const current = state.nodes.get(state.currentId);
  if (!current) throw new Error('HISTORY_CURRENT_NODE_MISSING');
  return current.document;
};
