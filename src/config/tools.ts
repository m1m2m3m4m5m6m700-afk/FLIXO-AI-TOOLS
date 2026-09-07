import type { ComponentType, LazyExoticComponent } from 'react';
import { TOOL_MANIFEST, getToolManifest, getToolManifestByPath } from './tool-manifest.ts';

export type { ToolConfig } from './tool-definitions.ts';
export type { ToolFamily } from './tool-definitions/types.ts';
export type ToolComponent = LazyExoticComponent<ComponentType>;

export const TOOLS_REGISTRY = TOOL_MANIFEST;
export const TOOL_MANIFEST_ENTRIES = TOOL_MANIFEST;

export const getToolConfig = getToolManifest;
export const getToolConfigByPath = getToolManifestByPath;
export const getReadyToolConfigs = () => TOOL_MANIFEST.filter((tool) => tool.isReady);
