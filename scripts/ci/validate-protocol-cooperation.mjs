import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = process.env.FLIXO_SOURCE_SHA || process.env.EXPECTED_HEAD_SHA;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expected && expected !== actual) {
  console.error(`Protocol cooperation failed: ${actual} != ${expected}`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const scripts = packageJson.scripts ?? {};
const requiredScripts = [
  'validate:baseline',
  'validate:tool-registry',
  'validate:tool-manifest',
  'validate:router-registry',
  'validate:i18n',
  'validate:canonical-locale-surface',
  'validate:seo',
  'validate:seo-manifest',
  'test:unit',
];
const failures = [];
for (const script of requiredScripts) if (!scripts[script]) failures.push(`package.json missing cooperation endpoint: ${script}`);
if (!scripts['verify:contracts']?.includes('validate:canonical-locale-surface')) failures.push('verify:contracts does not consume the canonical locale gate.');
if (!scripts.check?.includes('validate:canonical-locale-surface')) failures.push('check does not consume the canonical locale gate.');
const routes = readFileSync('src/routes/route-tree.ts', 'utf8');
const seo = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');
const manifest = readFileSync('scripts/validate-seo-manifest.mjs', 'utf8');
if (!/localizedToolRoute/u.test(routes)) failures.push('route resolver/route tree cooperation missing localizedToolRoute.');
if (!/getLocalizedToolUrl/u.test(seo)) failures.push('SEO does not consume canonical localized route resolution.');
if (!/src\/lib\/i18n\/config\.ts/u.test(manifest)) failures.push('SEO manifest validator is not coupled to canonical locale config.');
if (/continue-on-error:\s*true/u.test(readFileSync('.github/workflows/matrix-ci-recovery.yml', 'utf8'))) failures.push('protocol cooperation graph suppresses failures.');
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Protocol cooperation PASS for exact SHA ${actual}: Registry → Routes → SEO → Locale → Verification chain is connected.`);
