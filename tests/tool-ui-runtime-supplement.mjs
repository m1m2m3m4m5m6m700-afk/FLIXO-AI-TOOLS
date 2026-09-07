import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const repositoryRoot = new URL('..', import.meta.url);
const forbiddenRuntimeFiles = [
  'src/lib/i18n/runtime-document-locale.ts',
  'src/lib/i18n/tool-ui-runtime.ts',
  'src/lib/i18n/tool-ui-runtime-supplement.ts',
  'src/lib/i18n/tool-ui-runtime-completeness.ts',
  'src/lib/i18n/tool-ui-runtime-ms-uk.ts',
  'src/lib/i18n/tool-ui-technical-values.ts',
  'src/components/auto-localized-tool-surface.tsx',
];

for (const relativePath of forbiddenRuntimeFiles) {
  assert.equal(existsSync(new URL(relativePath, repositoryRoot)), false, `legacy localization runtime must remain removed: ${relativePath}`);
}

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
assert.match(mainSource, /router\.subscribe\('onResolved'/u);
assert.match(mainSource, /useSyncExternalStore\(subscribeToResolvedLocation, getRouterPathname, getServerPathname\)/u);
assert.match(mainSource, /document\.documentElement/u);
assert.match(mainSource, /setAttribute\('lang', metadata\.languageTag\)/u);
assert.match(mainSource, /setAttribute\('dir', metadata\.direction\)/u);
assert.match(mainSource, /setAttribute\('data-flixo-locale', locale\)/u);

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(indexSource, /<div id="root"><\/div>/u);

const i18nSource = readFileSync(new URL('../src/lib/i18n/config.ts', import.meta.url), 'utf8');
assert.match(i18nSource, /export const LOCALES\s*=\s*\[[\s\S]*'vi'\]\s+as const/u);

console.log(`G4 localization architecture contract PASS (${forbiddenRuntimeFiles.length} legacy runtime modules absent)`);
