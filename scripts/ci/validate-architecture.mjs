import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(path, 'utf8');
const workflows = readdirSync('.github/workflows').filter((file) => /\.(ya?ml)$/u.test(file));
const ci = read('.github/workflows/ci.yml');
const config = read('src/lib/i18n/config.ts');
const packageJson = JSON.parse(read('package.json'));

if (!/pull_request:\s*\n\s*branches:\s*\[main\]/u.test(ci)) fail('ci.yml must run on pull requests targeting main.');
if (!/workflow_dispatch:/u.test(ci)) fail('ci.yml must support manual diagnostics/certification.');
if (!/push:\s*\n\s*branches:\s*\[main\]/u.test(ci)) fail('ci.yml must preserve main push verification.');
if (!/name:\s*Test — Static \/ Build \/ Browser/u.test(ci)) fail('ci.yml must expose one unified application test job.');
if (!/name:\s*CERTIFY/u.test(ci)) fail('ci.yml must expose one fail-closed CERTIFY job.');
if (!/name:\s*STATIC[\s\S]*npm run test:static/u.test(ci)) fail('STATIC gate is missing from canonical CI.');
if (!/name:\s*BUILD[\s\S]*npm run test:build/u.test(ci)) fail('BUILD gate is missing from canonical CI.');
if (!/name:\s*BROWSER[\s\S]*npm run test:browser/u.test(ci)) fail('BROWSER gate is missing from canonical CI.');
if (!/Record repair-cycle diagnostics[\s\S]*always\(\)[\s\S]*npm run diagnose:cycle/u.test(ci)) fail('CI must record repair-cycle diagnostics with always().');
if (!/upload-artifact@v6/u.test(ci) || !/diagnostics\/ci\//u.test(ci)) fail('CI must publish unified diagnostics artifacts.');
if (!/retention-days:\s*30/u.test(ci)) fail('CI diagnostics retention must be 30 days.');
if (!/test "\$\{\{ needs\.test\.result \}\}" = "success"/u.test(ci)) fail('CERTIFY must fail closed on the unified test result.');
if (packageJson.scripts?.test !== 'node scripts/test.mjs --mode=certification') fail('npm test must use the unified certification runner.');
if (packageJson.scripts?.['diagnose:cycle'] !== 'node scripts/ci/record-repair-cycle.mjs') fail('diagnose:cycle must use the repair-cycle collector.');

const localeList = config.match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1]?.match(/['"][a-z]{2}['"]/gu)?.map((value) => value.slice(1, -1)) ?? [];
const canonical = ['ar','en','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];
if (localeList.length !== canonical.length || localeList.some((locale, index) => locale !== canonical[index])) fail(`Canonical locale drift: ${localeList.join(',')}`);

const sourceFiles = [];
function collect(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) collect(path);
    else if (/\.(ts|tsx|mjs)$/u.test(entry)) sourceFiles.push(path);
  }
}
collect('src');
for (const file of sourceFiles) {
  const source = read(file);
  if (/ms-uk|localizeMsUk|tool-seo-localization|from ['\"][^'\"]*\/ms['\"]|from ['\"][^'\"]*\/uk['\"]/u.test(source)) fail(`Legacy locale architecture remains in ${file}.`);
}

for (const forbidden of ['PDF', 'CSV', 'MP3', 'MP4']) {
  if (sourceFiles.some((file) => new RegExp(`['\"]${forbidden}['\"]`, 'u').test(read(file)))) fail(`Forbidden legacy product surface token remains: ${forbidden}.`);
}

const manifest = read('src/lib/seo/tool-manifest.ts');
const catalog = read('src/lib/seo/tool-catalog.ts');
if (!manifest.includes('assertCompleteToolSeoLocales')) fail('SEO manifest completeness validator is missing.');
if (!catalog.includes('Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)]))')) fail('SEO catalog is not data-driven from the canonical locale set.');
if (!catalog.includes("seoStatus: 'complete'")) fail('SEO catalog must mark generated manifests complete.');

const testRunner = read('scripts/test.mjs');
for (const gate of ['static', 'build', 'browser']) if (!testRunner.includes(`writeGateReport('${gate}'`)) fail(`Unified runner does not produce a ${gate} report.`);
if (!testRunner.includes('fingerprint') || !testRunner.includes('rootCauseId') || !testRunner.includes('repro')) fail('Unified runner is missing root-cause/fingerprint/repro diagnostics.');

if (failures.length) {
  console.error(`Architecture contract failed with ${failures.length} issue(s):`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Architecture contract PASS: unified three-gate CI, fail-closed certification, cycle diagnostics, ${canonical.length} canonical locales, and legacy-surface closure verified.`);
