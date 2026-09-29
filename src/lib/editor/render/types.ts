export type RenderBackend = 'canvas2d' | 'wasm' | 'webgl' | 'webgpu';

export type RenderNode = Readonly<{
  id: string;
  operation: string;
  dependencies: readonly string[];
  backends: readonly RenderBackend[];
  parameters: Readonly<Record<string, string | number | boolean>>;
}>;

export type RenderGraph = Readonly<{
  version: 1;
  nodes: readonly RenderNode[];
  outputNodeId: string;
}>;
