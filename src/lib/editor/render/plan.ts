import type { RenderGraph } from './types';

export type Region = Readonly<{ x: number; y: number; width: number; height: number }>;
export type RenderPlanNode = Readonly<{
  id: string;
  dependencies: readonly string[];
  dirtyRegions: readonly Region[];
  cacheKey: string;
}>;

export type RenderPlan = Readonly<{
  version: 1;
  graph: RenderGraph;
  nodes: readonly RenderPlanNode[];
  documentVersion: number;
  renderVersion: number;
}>;

const normalizeRegion = (region: Region): Region => {
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite) || region.width <= 0 || region.height <= 0) {
    throw new Error('RENDER_REGION_INVALID');
  }
  return Object.freeze({ ...region });
};

export const createRenderPlan = (
  graph: RenderGraph,
  documentVersion: number,
  renderVersion: number,
  dirtyRegions: Readonly<Record<string, readonly Region[]>> = {},
): RenderPlan => {
  if (!Number.isInteger(documentVersion) || documentVersion < 1) throw new Error('DOCUMENT_VERSION_INVALID');
  if (!Number.isInteger(renderVersion) || renderVersion < 1) throw new Error('RENDER_VERSION_INVALID');
  const nodes = Object.freeze(graph.nodes.map((node) => Object.freeze({
    id: node.id,
    dependencies: Object.freeze([...node.dependencies]),
    dirtyRegions: Object.freeze((dirtyRegions[node.id] ?? []).map(normalizeRegion)),
    cacheKey: [documentVersion, renderVersion, node.id, node.operation, JSON.stringify(node.parameters)].join(':'),
  })));
  return Object.freeze({ version: 1 as const, graph, nodes, documentVersion, renderVersion });
};

export const assertRenderPlanFresh = (plan: RenderPlan, documentVersion: number, renderVersion: number): true => {
  if (plan.documentVersion !== documentVersion || plan.renderVersion !== renderVersion) throw new Error('STALE_RENDER_PLAN');
  return true;
};