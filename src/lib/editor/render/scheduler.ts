import type { RenderGraph, RenderBackend, RenderNode } from './types';
import { topologicalOrder } from './graph';

export type RenderSchedule = Readonly<{backend:RenderBackend; nodes:readonly RenderNode[]}>;
export function createRenderSchedule(graph:RenderGraph, backend:RenderBackend='canvas2d'): RenderSchedule {
  const nodes=topologicalOrder(graph);
  for(const node of nodes) if(!node.backends.includes(backend)) throw new Error('RENDER_BACKEND_UNSUPPORTED');
  return Object.freeze({backend,nodes});
}
