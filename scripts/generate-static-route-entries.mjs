import fs from 'node:fs';
import path from 'node:path';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES } from '../src/lib/i18n/config.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const distDir = path.resolve(process.env.FLIXO_STATIC_OUTPUT_DIR ?? 'dist');
const indexFile = path.join(distDir, 'index.html');

if (!fs.existsSync(indexFile)) {
  throw new Error(`Static route generation requires ${indexFile}. Run the Vite build first.`);
}

const indexHtml = fs.readFileSync(indexFile);
const routes = new Set();

for (const locale of LOCALES) {
  routes.add(`/${locale}`);
  for (const tool of TOOL_MANIFEST.filter((entry) => entry.isReady)) {
    routes.add(getLocalizedToolPath(tool, locale));
    for (const alias of tool.aliases ?? []) {
      const localizedAlias = alias.startsWith('/en/')
        ? `/${locale}${alias.slice('/en'.length)}`
        : alias;
      routes.add(localizedAlias.startsWith(`/${locale}/`) ? localizedAlias : getLocalizedToolPath(tool, locale));
    }
  }
}

const isSafeRoute = (route) => {
  if (!route.startsWith('/') || route.includes('..') || route.includes('?') || route.includes('#')) return false;
  const segments = route.split('/').filter(Boolean);
  return segments.every((segment) => /^[A-Za-z0-9_-]+$/u.test(segment));
};

for (const route of routes) {
  if (!isSafeRoute(route)) throw new Error(`Unsafe static route generated: ${route}`);
  const targetDir = path.join(distDir, route.slice(1));
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml);
}

console.log(`Static route entries generated: ${routes.size}`);
console.log(`Ready tools: ${TOOL_MANIFEST.filter((entry) => entry.isReady).length}`);
console.log(`Locales: ${LOCALES.length}`);
