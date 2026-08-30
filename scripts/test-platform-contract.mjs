import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES, LOCALE_METADATA, getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const fail = (message, details = []) => {
  console.error(`G1 PLATFORM CONTRACT FAILED: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
};

const run = (label, command, args, env = {}) => {
  console.log(`\n===== G1 PLATFORM CONTRACT: ${label} =====`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.error) fail(`${label} could not start`, [result.error.message]);
  if (result.status !== 0) fail(`${label} failed`, [`exit=${result.status ?? 'unknown'}`]);
};

const canonicalOrigin = getCanonicalSiteOrigin();
if (canonicalOrigin !== 'https://flixoai.vercel.app') fail('canonical origin drift', [canonicalOrigin]);

run('registry', process.execPath, ['scripts/validate-tool-registry-contract.mjs']);
run('manifest', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-tool-manifest.mjs']);
run('router ↔ registry', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-router-registry.mjs']);
run('SEO', process.execPath, ['scripts/validate-seo.mjs']);
run('site origin', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-site-origin.mjs'], { VITE_SITE_URL: canonicalOrigin });
run('indexing', process.execPath, ['scripts/validate-indexing.mjs']);

const routeSource = readFileSync('src/routes/localized-tool.tsx', 'utf8');
for (const token of ['loader:', 'getToolConfig(params.tool)', '!tool?.isReady', 'notFound()', 'notFoundComponent:']) {
  if (!routeSource.includes(token)) fail('localized tool readiness/404 boundary is incomplete', [`missing=${token}`]);
}

const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
const ids = TOOLS_REGISTRY.map((tool) => tool.id);
const routes = TOOLS_REGISTRY.flatMap((tool) => [tool.path, ...(tool.aliases ?? [])]);
const duplicate = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
if (duplicate(ids).length) fail('duplicate tool ids', duplicate(ids));
if (duplicate(routes).length) fail('duplicate canonical/alias routes', duplicate(routes));
if (TOOL_MANIFEST.length !== TOOLS_REGISTRY.length) fail('manifest/registry cardinality drift', [`manifest=${TOOL_MANIFEST.length}`, `registry=${TOOLS_REGISTRY.length}`]);

const temp = mkdtempSync(join(tmpdir(), 'flixo-g1-'));
try {
  run('sitemap generation', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/generate-sitemap.mjs'], { VITE_SITE_URL: canonicalOrigin, FLIXO_GENERATED_OUTPUT_DIR: temp });
  run('robots generation', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/generate-robots.mjs'], { VITE_SITE_URL: canonicalOrigin, FLIXO_GENERATED_OUTPUT_DIR: temp });
  const sitemap = readFileSync(join(temp, 'sitemap.xml'), 'utf8');
  const robots = readFileSync(join(temp, 'robots.txt'), 'utf8');
  const expectedUrls = new Set(LOCALES.flatMap((locale) => [
    `/${locale}`,
    ...readyTools.map((tool) => getLocalizedToolPath(tool, locale)),
  ].map((route) => new URL(route, `${canonicalOrigin}/`).toString())));
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  const actualUrls = new Set(locs);
  if (locs.length !== actualUrls.size) fail('duplicate sitemap URLs detected');
  const missing = [...expectedUrls].filter((url) => !actualUrls.has(url));
  const unexpected = [...actualUrls].filter((url) => !expectedUrls.has(url));
  if (missing.length || unexpected.length || expectedUrls.size !== actualUrls.size) {
    fail('sitemap registry drift', [`expected=${expectedUrls.size}`, `actual=${actualUrls.size}`, ...missing.slice(0, 10).map((url) => `missing=${url}`), ...unexpected.slice(0, 10).map((url) => `unexpected=${url}`)]);
  }
  const expectedHreflangs = [...LOCALES.map((locale) => LOCALE_METADATA[locale].languageTag), 'x-default'];
  for (const url of actualUrls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const block = sitemap.match(new RegExp(`<url>\\s*<loc>${escaped}<\\/loc>([\\s\\S]*?)<\\/url>`, 'u'));
    if (!block) fail('missing sitemap URL block', [url]);
    const hreflangs = [...block[1].matchAll(/hreflang="([^"]+)"/gu)].map((match) => match[1]);
    if (hreflangs.length !== expectedHreflangs.length || expectedHreflangs.some((lang) => !hreflangs.includes(lang))) fail('sitemap hreflang drift', [url]);
  }
  if (!robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) fail('robots is not bound to canonical sitemap');
  if (/localhost|127\.0\.0\.1|canonical\.test|git-main-|flexo1\.vercel\.app/iu.test(`${sitemap}\n${robots}`)) fail('preview/test origin leaked into discovery artifacts');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(`G1 PLATFORM CONTRACT PASSED: registry=${TOOLS_REGISTRY.length}, ready=${readyTools.length}, locales=${LOCALES.length}, sitemap=${LOCALES.length * (readyTools.length + 1)}, canonical=${canonicalOrigin}`);
