import { readFileSync } from 'node:fs';

const canonicalPath = 'src/config/tool-definitions/canonical.ts';
const registryPath = 'src/config/registry.ts';
const manifestPath = 'src/config/tool-manifest.ts';
const capabilityPath = 'src/lib/agent/capability-registry.ts';
const imagePath = 'src/config/tool-definitions/image.ts';

const canonical = readFileSync(canonicalPath, 'utf8');
const registry = readFileSync(registryPath, 'utf8');
const manifest = readFileSync(manifestPath, 'utf8');
const capability = readFileSync(capabilityPath, 'utf8');
const image = readFileSync(imagePath, 'utf8');

const requiredFields = [
  'id',
  'family',
  'title',
  'description',
  'category',
  'isReady',
  'path',
  'routes',
  'aliases',
  'component',
  'capability',
  'localization',
  'seo',
];

const failures = [];
if (!canonical.includes('export type ToolDefinition')) failures.push('ToolDefinition type is missing.');
for (const field of requiredFields) {
  if (!canonical.includes(`${field}:`)) failures.push(`ToolDefinition field missing: ${field}`);
}
if (!canonical.includes('export const TOOL_DEFINITIONS')) failures.push('Canonical TOOL_DEFINITIONS export is missing.');
if (!registry.includes("import { TOOL_DEFINITIONS } from './tool-definitions/canonical.ts'")) failures.push('Registry is not sourced from canonical definitions.');
if (!manifest.includes("import { TOOL_DEFINITIONS } from './tool-definitions/canonical.ts'")) failures.push('Manifest is not sourced from canonical definitions.');
if (!capability.includes("import { TOOL_DEFINITIONS } from '@/config/tool-definitions/canonical'")) failures.push('Capability registry is not sourced from canonical definitions.');
if ((image.match(/\{ id:/g) ?? []).length !== 22) failures.push(`Expected 22 legacy image entries, found ${(image.match(/\{ id:/g) ?? []).length}.`);
if (canonical.includes("const EXECUTABLE_IDS = new Set") === false) failures.push('Canonical capability state rules are missing.');
if (!canonical.includes("executionMode: tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL'")) failures.push('Canonical execution mode rule is missing.');
if (!canonical.includes('titleKey: `tool.${tool.id}.title`')) failures.push('Canonical localization title key derivation is missing.');
if (!canonical.includes('descriptionKey: `tool.${tool.id}.description`')) failures.push('Canonical localization description key derivation is missing.');
if (!canonical.includes("robots: 'index,follow,max-image-preview:large'")) failures.push('Canonical SEO robots contract is missing.');

if (failures.length) {
  for (const failure of failures) console.error(`TOOL-DEFINITION-CONTRACT: FAIL: ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  authority: 'canonical-tool-definition-contract',
  status: 'PASS',
  expectedToolCount: 22,
  requiredFields,
  derivedConsumers: ['registry', 'manifest', 'capability-registry'],
}));
