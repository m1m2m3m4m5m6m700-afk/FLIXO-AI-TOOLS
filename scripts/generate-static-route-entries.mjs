import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES } from '../src/lib/i18n/config.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const DIST_DIR = process.env.FLIXO_DIST_DIR ?? 'dist';
const INDEX_FILE = join(DIST_DIR, 'index.html');

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
if (!readyTools.length) throw new Error('Static route generation requires at least one ready tool.');

const copyEntry = (route) => {
  const normalizedRoute = route.replace(/^\//u, '').replace(/\/$/u, '');
  const routeDir = normalizedRoute ? join(DIST_DIR, normalizedRoute) : DIST_DIR;
  mkdirSync(routeDir, { recursive: true });
  copyFileSync(INDEX_FILE, join(routeDir, 'index.html'));
};

// Non-localized operational entry points must also exist as physical static
// entries because the production deployment is an immutable Vercel static
// artifact rather than a source-tree deployment.
copyEntry('/admin');

for (const locale of LOCALES) {
  copyEntry(`/${locale}`);

  for (const tool of readyTools) {
    copyEntry(getLocalizedToolPath(tool, locale));
  }
}

console.log(`G1 static route entries generated: ready=${readyTools.length}, locales=${LOCALES.length}, routes=${readyTools.length * LOCALES.length + LOCALES.length + 1}`);
