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
const baselineSha = process.env.BASELINE_SHA;

assert.match(env, /^VITE_SITE_URL=/m);
assert.match(gitignore, /diagnostics\//);
assert.match(gitignore, /evidence\//);
assert.match(gitignore, /release\/finalization\//);
assert.ok(baselineSha, 'BASELINE_SHA must be provided by the CI baseline identity contract');
assert.match(baselineSha, /^[0-9a-f]{40}$/u, 'BASELINE_SHA must be a 40-character Git SHA');
assert.match(debt, new RegExp(`Main SHA: \\`${baselineSha}\\``));
assert.doesNotMatch(main, /VITE_.*API_KEY/);
assert.doesNotMatch(main, /installToolUiRuntime(Localization|Supplement|Completeness)|installToolUiTechnicalValueNormalization/u);
assert.doesNotMatch(main, /MutationObserver/u);
assert.match(page, /data-flixo-i18n-root="tool-surface"/u);
assert.doesNotMatch(autoSurface, /MutationObserver|createTreeWalker|textContent\s*=/u);
assert.match(observerContract, /process\.exit\(1\)/u);

console.log('Unified audit repository controls: PASS');
