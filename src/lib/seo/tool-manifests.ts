import { getReadyToolConfigs } from '../../config/tools';
import { buildAllToolSeoManifests } from './tool-catalog';
import type { ToolManifest } from './tool-manifest';

export const TOOL_SEO_MANIFESTS: readonly ToolManifest[] = buildAllToolSeoManifests(getReadyToolConfigs());

export const getToolSeoManifest = (toolId: string): ToolManifest | undefined =>
  TOOL_SEO_MANIFESTS.find((manifest) => manifest.toolId === toolId);
