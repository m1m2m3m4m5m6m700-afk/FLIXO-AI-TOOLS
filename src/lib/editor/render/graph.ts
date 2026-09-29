import type { RenderGraph, RenderNode } from './types';

const byId = (nodes: readonly RenderNode[]): Map<string, RenderNode> => new Map(nodes.map((node) => [node.id, node]));

export const createRenderGraph = (nodes: readonly RenderNode[], outputNodeId: string): RenderGraph => {
  if (!outputNodeId.trim()) throw new Error('RENDER_OUTPUT_REQUIRED');
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id.trim()) throw new Error('RENDER_NODE_ID_REQUIRED');
    if (ids.has(node.id)) throw new Error('DUPLICATE_RENDER_NODE_ID');
    ids.add(node.id);
    if (!node.operation.trim()) throw new Error('RENDER_OPERATION_REQUIRED');
    if (node.backends.length === 0) throw new Error('RENDER_BACKEND_REQUIRED');
  }
  if (!ids.has(outputNodeId)) throw new Error('RENDER_OUTPUT_NODE_MISSING');
  const graph = Object.freeze({ version: 1 as const, nodes: Object.freeze([...nodes]), outputNodeId });
  validateRenderGraph(graph);
  return graph;
};

export const validateRenderGraph = (graph: RenderGraph): true => {
  const nodes = byId(graph.nodes);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('RENDER_GRAPH_CYCLE');
    if (visited.has(id)) return;
    const node = nodes.get(id);
    if (!node) throw new Error('RENDER_DEPENDENCY_MISSING');
    visiting.add(id);
    for (const dependency of node.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };

  visit(graph.outputNodeId);
  return true;
};

export const topologicalOrder = (graph: RenderGraph): readonly RenderNode[] => {
  const nodes = byId(graph.nodes);
  const result: RenderNode[] = [];
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    const node = nodes.get(id);
    if (!node) throw new Error('RENDER_DEPENDENCY_MISSING');
    for (const dependency of node.dependencies) visit(dependency);
    visited.add(id);
    result.push(node);
  };

  visit(graph.outputNodeId);
  return Object.freeze(result);
};
