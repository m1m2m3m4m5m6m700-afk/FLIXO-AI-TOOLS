import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const failures = [];
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));

const TOOL_REGISTRY = 'src/config/tool-definitions/image.ts';

const [baseline, toolsSource, routerSource, manifestSource] = await Promise.all([
  readJson('config/engineering-baseline.json'),
  readText(TOOL_REGISTRY),
  readText('src/router.tsx'),
  readText('src/lib/seo/tool-manifests.ts'),
]);

if (baseline.productionBranch !== 'main') failures.push('productionBranch must be main');
if (baseline.canonicalVerification !== 'npm run verify') failures.push('canonicalVerification must be npm run verify');
if (baseline.rules?.registryIsSourceOfTruth !== true) failures.push('registryIsSourceOfTruth must remain enabled');
if (baseline.rules?.noNonReadyStaticRoutes !== true) failures.push('noNonReadyStaticRoutes must remain enabled');
if (baseline.rules?.noDuplicateVerificationTruth !== true) failures.push('noDuplicateVerificationTruth must remain enabled');

const toolPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'[\s\S]*?isReady:\s*(true|false)[\s\S]*?component:\s*lazy\(/g;
const tools = [...toolsSource.matchAll(toolPattern)].map((match) => ({ id: match[1], category: match[2], isReady: match[3] === 'true' }));
if (tools.length === 0) failures.push('could not parse Image Registry readiness entries');
if (tools.some((tool) => tool.category !== 'Images')) failures.push('all registry tools must use category Images');
if (tools.some((tool) => /^(AI|Other)$/.test(tool.category))) failures.push('legacy AI/Other product taxonomy detected');

const toPascal = (value) => value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
for (const tool of tools.filter(({ isReady }) => !isReady)) {
  const routeSymbol = `en${toPascal(tool.id)}Route`;
  if (routerSource.includes(routeSymbol)) failures.push(`non-ready image tool ${tool.id} is still statically registered in src/router.tsx (${routeSymbol})`);
}

if (!manifestSource.includes('getReadyToolConfigs()')) failures.push('SEO manifest must be derived from ready Image Registry tools');
if (/pdf|audio|video|csv/i.test(manifestSource)) failures.push('legacy non-image artifact taxonomy detected in SEO manifest source');

if (failures.length > 0) {
  console.error('FLIXO engineering baseline: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const ready = tools.filter(({ isReady }) => isReady).length;
const nonReady = tools.length - ready;
console.log('FLIXO engineering baseline: PASS');
console.log(`image registry tools: ${tools.length}`);
console.log(`ready image tools: ${ready}`);
console.log(`non-ready image tools: ${nonReady}`);
