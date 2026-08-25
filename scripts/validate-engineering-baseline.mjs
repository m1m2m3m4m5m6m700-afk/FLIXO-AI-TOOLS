import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const failures = [];

const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));

const [baseline, toolsSource, definitionsSource, routerSource] = await Promise.all([
  readJson('config/engineering-baseline.json'),
  readText('src/config/tools.ts'),
  readText('src/config/tool-definitions.ts'),
  readText('src/router.tsx'),
]);

if (baseline.productionBranch !== 'main') failures.push('productionBranch must be main');
if (baseline.canonicalVerification !== 'npm run verify') failures.push('canonicalVerification must be npm run verify');
if (baseline.rules?.registryIsSourceOfTruth !== true) failures.push('registryIsSourceOfTruth must remain enabled');
if (baseline.rules?.noNonReadyStaticRoutes !== true) failures.push('noNonReadyStaticRoutes must remain enabled');
if (baseline.rules?.noDuplicateVerificationTruth !== true) failures.push('noDuplicateVerificationTruth must remain enabled');

const toolPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?isReady:\s*(true|false)[\s\S]*?component:\s*lazy\(/g;
const source = toolPattern.test(toolsSource) ? toolsSource : definitionsSource;
toolPattern.lastIndex = 0;
const tools = [...source.matchAll(toolPattern)].map((match) => ({ id: match[1], isReady: match[2] === 'true' }));

if (tools.length === 0) failures.push('could not parse tool registry readiness entries');

const toPascal = (value) => value
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join('');

for (const tool of tools.filter(({ isReady }) => !isReady)) {
  const routeSymbol = `en${toPascal(tool.id)}Route`;
  if (routerSource.includes(routeSymbol)) {
    failures.push(`non-ready tool ${tool.id} is still statically registered in src/router.tsx (${routeSymbol})`);
  }
}

if (failures.length > 0) {
  console.error('FLIXO engineering baseline: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const ready = tools.filter(({ isReady }) => isReady).length;
const nonReady = tools.length - ready;
console.log('FLIXO engineering baseline: PASS');
console.log(`registry tools: ${tools.length}`);
console.log(`ready tools: ${ready}`);
console.log(`non-ready tools: ${nonReady}`);
