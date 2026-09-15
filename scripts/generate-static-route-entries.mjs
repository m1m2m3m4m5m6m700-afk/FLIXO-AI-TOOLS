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

// The production deployment is an immutable Vercel artifact. Materialize
// operational routes as physical entries so direct navigation cannot become
// a Vercel static 404.
copyEntry('/admin');

// Materialize the authenticated admin read boundary alongside the immutable
// artifact. Vercel detects the /api tree as serverless functions during deploy;
// these files stay isolated from the browser bundle.
const adminApiSourceDir = join('api', 'admin');
const adminApiDistDir = join(DIST_DIR, 'api', 'admin');
mkdirSync(adminApiDistDir, { recursive: true });
for (const file of ['boundary.ts', 'canonical.ts', 'persistence.ts', 'centers.ts']) {
  copyFileSync(join(adminApiSourceDir, file), join(adminApiDistDir, file));
}

for (const locale of LOCALES) {
  copyEntry(`/${locale}`);

  for (const tool of readyTools) {
    copyEntry(getLocalizedToolPath(tool, locale));
  }
}

console.log(`G1 static route entries generated: ready=${readyTools.length}, locales=${LOCALES.length}, routes=${readyTools.length * LOCALES.length + LOCALES.length + 1}, adminApi=4`);
