import { readFileSync } from 'node:fs';

const source = readFileSync('src/lib/seo/use-cases.ts', 'utf8');
const toolsSource = readFileSync('src/config/tool-definitions.ts', 'utf8');
const routerSource = readFileSync('src/router.tsx', 'utf8');
const routeTreeSource = readFileSync('src/routes/route-tree.ts', 'utf8');
const routeSource = readFileSync('src/routes/use-case.tsx', 'utf8');

const slugs = [...source.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
const refs = [...source.matchAll(/toolIds: \[([^\]]+)\]/g)].flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
const readyTools = new Set([...toolsSource.matchAll(/id: '([^']+)'[^\n]*isReady: true,/g)].map((match) => match[1]));
const routeRegistrySource = `${routerSource}\n${routeTreeSource}`;

if (slugs.length === 0) throw new Error('No use cases declared.');
if (new Set(slugs).size !== slugs.length) throw new Error('Duplicate use-case slugs detected.');
for (const toolId of refs) {
  if (!readyTools.has(toolId)) throw new Error(`Use case references non-ready or missing tool: ${toolId}`);
}
if (!routeRegistrySource.includes('useCaseRoute')) throw new Error('Use-case route is not registered.');
if (!routeSource.includes("path: '/use-cases/$slug'")) throw new Error('Use-case route path is missing.');
if (!routeSource.includes('application/ld+json')) throw new Error('Use-case JSON-LD is missing.');
if (!routeSource.includes('href={`/en/${tool.id}`}')) throw new Error('Use-case internal tool links are missing.');

console.log(`Use-case SEO validation passed: ${slugs.length} use cases, ${refs.length} tool references, unique slugs, registered route, JSON-LD, and internal links present.`);
