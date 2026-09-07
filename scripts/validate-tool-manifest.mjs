import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';

const fail = (message) => {
  console.error(`TOOL_MANIFEST_FAILURE ${message}`);
  process.exit(1);
};

if (!Array.isArray(TOOL_MANIFEST) || TOOL_MANIFEST.length === 0) {
  fail('image manifest is empty or invalid');
}

const ids = new Set();
const routes = new Map();

for (const tool of TOOL_MANIFEST) {
  if (!tool.id || ids.has(tool.id)) fail(`duplicate tool id: ${tool.id}`);
  if (!tool.path.startsWith('/en/')) fail(`invalid canonical path: ${tool.id}`);
  if (tool.family !== 'image') fail(`non-image family: ${tool.id}`);
  if (tool.category !== 'Images') fail(`non-image category: ${tool.id}`);
  if (!tool.seo?.title || !tool.seo?.description) fail(`missing SEO metadata: ${tool.id}`);
  if (routes.has(tool.path)) fail(`duplicate canonical path: ${tool.path}`);

  ids.add(tool.id);
  routes.set(tool.path, tool.id);

  for (const alias of tool.aliases ?? []) {
    const owner = routes.get(alias);
    if (owner && owner !== tool.id) fail(`alias collision: ${alias}`);
    routes.set(alias, tool.id);
  }
}

console.log(`image tool manifest entries: ${TOOL_MANIFEST.length}`);
console.log(`image tool manifest routes: ${routes.size}`);
console.log('image-only tool manifest contract: PASS');
