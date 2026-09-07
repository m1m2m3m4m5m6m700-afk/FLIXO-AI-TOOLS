import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const DIST_DIR = process.env.FLIXO_DIST_DIR ?? 'dist';
const INDEX_FILE = join(DIST_DIR, 'index.html');
const indexHtml = readFileSync(INDEX_FILE, 'utf8');

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
if (!readyTools.length) throw new Error('Static route generation requires at least one ready tool.');

function localizedDocument(index: string, locale: (typeof LOCALES)[number]): string {
  const metadata = LOCALE_METADATA[locale];
  if (!metadata) throw new Error(`Missing locale metadata for static route: ${locale}`);

  const documentShell = `<html lang="${metadata.languageTag}" dir="${metadata.direction}" data-flixo-locale="${locale}">`;
  const localized = index.replace(/<html\b[^>]*>/u, documentShell);
  if (localized === index) throw new Error(`Static route generation could not locate <html> shell for locale: ${locale}`);
  return localized;
}

for (const locale of LOCALES) {
  const localizedIndex = localizedDocument(indexHtml, locale);
  const homeDir = join(DIST_DIR, locale);
  mkdirSync(homeDir, { recursive: true });
  writeFileSync(join(homeDir, 'index.html'), localizedIndex);

  for (const tool of readyTools) {
    const route = getLocalizedToolPath(tool, locale).replace(/^\//u, '');
    const routeDir = join(DIST_DIR, route);
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, 'index.html'), localizedIndex);
  }
}

console.log(`G1 static route entries generated: ready=${readyTools.length}, locales=${LOCALES.length}, routes=${readyTools.length * LOCALES.length}`);
