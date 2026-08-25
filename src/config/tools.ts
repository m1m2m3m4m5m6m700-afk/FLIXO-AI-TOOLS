import type { ComponentType, LazyExoticComponent } from 'react';
import { TOOL_DEFINITIONS } from './tool-definitions';

export type { ToolConfig } from './tool-definitions';
export type ToolComponent = LazyExoticComponent<ComponentType>;

export const TOOLS_REGISTRY = TOOL_DEFINITIONS;

export const getToolConfig = (id: string) => TOOLS_REGISTRY.find((tool) => tool.id === id);
export const getToolConfigByPath = (path: string) => TOOLS_REGISTRY.find((tool) => tool.path === path || tool.aliases?.includes(path));
export const getReadyToolConfigs = () => TOOLS_REGISTRY.filter((tool) => tool.isReady);
