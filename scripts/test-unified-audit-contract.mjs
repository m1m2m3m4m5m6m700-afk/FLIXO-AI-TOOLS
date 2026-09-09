import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const main = await read('src/main.tsx');
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
assert.match(observerContract, /document\.body/u);
assert.match(observerContract, /process\.exit\(1\)/u);

console.log('Unified audit repository controls: PASS');
