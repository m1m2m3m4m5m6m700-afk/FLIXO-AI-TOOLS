import { readFileSync } from 'node:fs';

const canonicalPath = 'src/config/canonical-tool-definition.ts';
const registryPath = 'src/config/registry.ts';
const manifestPath = 'src/config/tool-manifest.ts';
const capabilityPath = 'src/lib/agent/capability-registry.ts';
const canonical = readFileSync(canonicalPath, 'utf8');
const registry = readFileSync(registryPath, 'utf8');
const manifest = readFileSync(manifestPath, 'utf8');
const capability = readFileSync(capabilityPath, 'utf8');

const requiredFields = [
  'id', 'family', 'title', 'description', 'category', 'isReady', 'path', 'routes',
  'aliases', 'component', 'capability', 'executionMode', 'parameterSchema',
  'safetyLimits', 'verifier', 'requirements', 'recovery', 'operational', 'localization', 'seo',
];

const failures = [];
if (!canonical.includes('export type ToolDefinition')) failures.push('ToolDefinition type is missing.');
for (const field of requiredFields) {
  if (!canonical.includes(`${field}:`)) failures.push(`ToolDefinition field missing: ${field}`);
}
if (!canonical.includes('export const TOOL_DEFINITIONS')) failures.push('Canonical TOOL_DEFINITIONS export is missing.');
if (!canonical.includes('const IMAGE_TOOL_CONFIGS: readonly ToolSource[]')) failures.push('Canonical image definition source is missing.');
const canonicalToolIds = [...canonical.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
const readyToolIds = [...canonical.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: true,/g)].map((match) => match[1]);
const unavailableToolIds = [...canonical.matchAll(/\{ id: '([^']+)',[^\n]*?isReady: false,/g)].map((match) => match[1]);
if (canonicalToolIds.length === 0) failures.push('Canonical tool inventory is empty.');
if (new Set(canonicalToolIds).size !== canonicalToolIds.length) failures.push('Duplicate canonical tool ids detected.');
if (readyToolIds.length + unavailableToolIds.length !== canonicalToolIds.length) failures.push('Canonical readiness inventory does not cover all tool definitions.');
if (!registry.includes("import { TOOL_DEFINITIONS } from './canonical-tool-definition.ts'")) failures.push('Registry is not sourced from canonical definitions.');
if (!registry.includes("./tool-platform/loader.ts")) failures.push('Registry is not wired through the single Tool Loader.');
if (!manifest.includes("import { TOOL_DEFINITIONS } from './canonical-tool-definition.ts'")) failures.push('Manifest is not sourced from canonical definitions.');
if (!capability.includes("import { TOOL_DEFINITIONS } from '@/config/canonical-tool-definition'")) failures.push('Capability registry is not sourced from canonical definitions.');
for (const [name, source] of [['registry', registry], ['manifest', manifest], ['capability', capability]]) {
  if (source.includes('tool-definitions/image')) failures.push(`${name} still references the legacy image definition source.`);
}
if (canonical.includes("from './tool-definitions/image.ts'")) failures.push('Canonical definition still imports the legacy image source.');
if (!canonical.includes("const EXECUTABLE_IDS = new Set")) failures.push('Canonical capability state rules are missing.');
if (!canonical.includes('ToolOperationalProfile')) failures.push('Canonical operational profile type is missing.');
if (!canonical.includes('recovery: ToolRecoveryPolicy')) failures.push('Canonical recovery policy is missing.');
if (!canonical.includes('outputContractId: tool.isReady ? tool.id : null')) failures.push('Canonical output contract binding is missing.');
if (!canonical.includes("const executionMode: ExecutionMode = tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL'")) failures.push('Canonical execution mode rule is missing.');
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
  expectedToolCount: canonicalToolIds.length,
  readyToolCount: readyToolIds.length,
  unavailableToolCount: unavailableToolIds.length,
  derivedConsumers: ['registry', 'manifest', 'capability-registry'],
  legacyImageSource: 'removed',
}));
