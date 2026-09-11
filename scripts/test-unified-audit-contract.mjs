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
assert.match(debt, /^## Verification Baseline$/m);
const verifiedSha = debt.match(/^- Last verified SHA: `([0-9a-f]{40})`$/mu)?.[1];
assert.ok(verifiedSha, 'Last verified SHA must be a valid 40-character Git SHA');
assert.match(debt, /^- Verification checkpoint: `[^`]+`$/m);
assert.match(debt, /^- Verification result: PASS$/m);
assert.match(debt, /^- Observed branch: main$/m);
assert.doesNotMatch(main, /VITE_.*API_KEY/);
assert.doesNotMatch(main, /installToolUiRuntime(Localization|Supplement|Completeness)|installToolUiTechnicalValueNormalization/u);
assert.doesNotMatch(main, /MutationObserver/u);
assert.match(page, /data-flixo-i18n-root="tool-surface"/u);
assert.doesNotMatch(autoSurface, /MutationObserver|createTreeWalker|textContent\s*=/u);
assert.match(observerContract, /process\.exit\(1\)/u);

console.log('Unified audit repository controls: PASS');
