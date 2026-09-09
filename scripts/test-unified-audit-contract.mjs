import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const main = await read('src/main.tsx');
const page = await read('src/routes/localized-tool-page.tsx');
const autoSurface = await read('src/components/auto-localized-tool-surface.tsx');
const env = await read('.env.example');
const gitignore = await read('.gitignore');
const debt = await read('docs/DEBT-REGISTER.md');
const observerContract = await read('scripts/validate-i18n-observer-boundary.mjs');

assert.match(env, /^VITE_SITE_URL=/m);
assert.match(gitignore, /diagnostics\//);
assert.match(gitignore, /evidence\//);
assert.match(gitignore, /release\/finalization\//);
assert.match(debt, /9cd646ae58ae2563e1513103ac5a9c96ba034fe7/);
assert.doesNotMatch(main, /VITE_.*API_KEY/);
assert.doesNotMatch(main, /installToolUiRuntime(Localization|Supplement|Completeness)|installToolUiTechnicalValueNormalization/u);
assert.doesNotMatch(main, /MutationObserver/u);
assert.match(page, /data-flixo-i18n-root="tool-surface"/u);
assert.doesNotMatch(autoSurface, /MutationObserver|createTreeWalker|textContent\s*=/u);
assert.match(observerContract, /process\.exit\(1\)/u);

console.log('Unified audit repository controls: PASS');
