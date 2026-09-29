import type { Mask, MaskId, MaskOperation } from './types';

export type MaskGraphNode = Readonly<{
  id: MaskId;
  mask: Mask;
  inputs: readonly MaskId[];
  operation: MaskOperation | null;
}>;

export type MaskGraph = Readonly<{
  version: 1;
  nodes: readonly MaskGraphNode[];
  outputNodeId: MaskId;
}>;

const nodeMap = (nodes: readonly MaskGraphNode[]) => new Map(nodes.map((node) => [node.id, node]));

export const createMaskGraph = (nodes: readonly MaskGraphNode[], outputNodeId: MaskId): MaskGraph => {
  if (!outputNodeId.trim()) throw new Error('MASK_OUTPUT_REQUIRED');
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id.trim()) throw new Error('MASK_NODE_ID_REQUIRED');
    if (ids.has(node.id)) throw new Error('DUPLICATE_MASK_NODE_ID');
    ids.add(node.id);
    if (node.mask.id !== node.id) throw new Error('MASK_NODE_ID_MISMATCH');
  }
  if (!ids.has(outputNodeId)) throw new Error('MASK_OUTPUT_NODE_MISSING');
  const graph = Object.freeze({ version: 1 as const, nodes: Object.freeze([...nodes]), outputNodeId });
  validateMaskGraph(graph);
  return graph;
};

export const validateMaskGraph = (graph: MaskGraph): true => {
  const nodes = nodeMap(graph.nodes);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('MASK_GRAPH_CYCLE');
    if (visited.has(id)) return;
    const node = nodes.get(id);
    if (!node) throw new Error('MASK_DEPENDENCY_MISSING');
    visiting.add(id);
    for (const input of node.inputs) visit(input);
    visiting.delete(id);
    visited.add(id);
  };
  visit(graph.outputNodeId);
  return true;
};

export const maskGraphOrder = (graph: MaskGraph): readonly MaskGraphNode[] => {
  validateMaskGraph(graph);
  const nodes = nodeMap(graph.nodes);
  const result: MaskGraphNode[] = [];
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    const node = nodes.get(id);
    if (!node) throw new Error('MASK_DEPENDENCY_MISSING');
    for (const input of node.inputs) visit(input);
    visited.add(id);
    result.push(node);
  };
  visit(graph.outputNodeId);
  return Object.freeze(result);
};