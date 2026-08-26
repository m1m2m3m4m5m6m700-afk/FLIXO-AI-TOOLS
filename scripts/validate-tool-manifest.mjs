import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';

const fail = (message) => {
  console.error(`TOOL_MANIFEST_FAILURE ${message}`);
  process.exit(1);
};

if (!Array.isArray(TOOL_MANIFEST) || TOOL_MANIFEST.length === 0) {
  fail('manifest is empty or invalid');
}

const ids = new Set();
const routes = new Map();
const families = new Set(['image', 'pdf', 'audio', 'video', 'ai', 'other']);

for (const tool of TOOL_MANIFEST) {
  if (!tool.id || ids.has(tool.id)) fail(`duplicate tool id: ${tool.id}`);
  if (!tool.path.startsWith('/en/')) fail(`invalid canonical path: ${tool.id}`);
  if (!families.has(tool.family)) fail(`invalid family: ${tool.id}`);
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

console.log(`tool manifest entries: ${TOOL_MANIFEST.length}`);
console.log(`tool manifest routes: ${routes.size}`);
console.log('tool manifest contract: PASS');
