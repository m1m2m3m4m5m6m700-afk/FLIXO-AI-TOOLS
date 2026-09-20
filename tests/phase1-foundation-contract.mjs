import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = (path) => readFile(path, 'utf8');

const [indexHtml, mainTsx, manifest, serviceWorker, privacy, toolPage] = await Promise.all([
  read('index.html'),
  read('src/main.tsx'),
  read('public/manifest.webmanifest'),
  read('public/sw.js'),
  read('src/lib/privacy.ts'),
  read('src/routes/localized-tool-page.tsx'),
]);

assert.match(indexHtml, /rel="manifest"/);
assert.match(mainTsx, /serviceWorker\.register\('\/sw\.js'\)/);
assert.match(manifest, /"display":\s*"standalone"/);
assert.match(serviceWorker, /CACHE_NAME\s*=\s*['"]flixo-shell-v1['"]/);
assert.match(privacy, /REMOTE_TOOL_IDS/);
assert.match(privacy, /ai-image-generator/);
assert.match(toolPage, /getToolPrivacyCopy\(seo\.tool\.id, locale\)/);

console.log('phase1-foundation-contract: PASS');
