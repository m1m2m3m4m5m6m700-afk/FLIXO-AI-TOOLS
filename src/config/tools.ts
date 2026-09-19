import { TOOL_MANIFEST, getToolManifest, getToolManifestByPath } from './tool-manifest.ts';
import { TOOL_REGISTRY } from './registry.ts';
import type { ToolDefinition } from './canonical-tool-definition.ts';

export type ToolConfig = ToolDefinition;
export type ToolComponent = ToolDefinition['component'];

export const TOOLS_REGISTRY = TOOL_REGISTRY;
export const TOOL_MANIFEST_ENTRIES = TOOL_MANIFEST;

export const getToolConfig = (id: string) => TOOL_REGISTRY.find((tool) => tool.id === id);
export const getToolConfigByPath = getToolManifestByPath;
export const getReadyToolConfigs = () => TOOL_REGISTRY.filter((tool) => tool.isReady);

export { getToolManifest };
