import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES } from '../src/lib/i18n/config.ts';
import { getToolPath } from '../src/lib/routing/route-resolver.ts';

const DIST_DIR = process.env.FLIXO_DIST_DIR ?? 'dist';
const INDEX_FILE = join(DIST_DIR, 'index.html');

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
if (!readyTools.length) throw new Error('Static route generation requires at least one ready tool.');

for (const locale of LOCALES) {
  const homeDir = join(DIST_DIR, locale);
  mkdirSync(homeDir, { recursive: true });
  copyFileSync(INDEX_FILE, join(homeDir, 'index.html'));

  for (const tool of readyTools) {
    const route = getToolPath(tool, locale).replace(/^\//u, '');
    const routeDir = join(DIST_DIR, route);
    mkdirSync(routeDir, { recursive: true });
    copyFileSync(INDEX_FILE, join(routeDir, 'index.html'));
  }
}

console.log(`G1 static route entries generated: ready=${readyTools.length}, locales=${LOCALES.length}, routes=${readyTools.length * LOCALES.length}`);
