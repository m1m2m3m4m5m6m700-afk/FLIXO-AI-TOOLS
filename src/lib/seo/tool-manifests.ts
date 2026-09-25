import { TOOL_CATALOG } from '../../config/registry';
import { buildAllToolSeoManifests } from './tool-catalog';
import type { ToolManifest } from './tool-manifest';

export const TOOL_SEO_MANIFESTS: readonly ToolManifest[] = buildAllToolSeoManifests(TOOL_CATALOG.ready);

export const getToolSeoManifest = (toolId: string): ToolManifest | undefined =>
  TOOL_SEO_MANIFESTS.find((manifest) => manifest.toolId === toolId);
