import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { extname, join, normalize, relative, sep } from 'node:path';
import { TOOLS_REGISTRY, getToolConfig } from '../src/config/tools.ts';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES, LOCALE_METADATA, getCanonicalSiteOrigin } from '../src/lib/i18n/config.ts';
import { getToolPath } from '../src/lib/routing/route-resolver.ts';
import { getToolSeo } from '../src/lib/seo/tool-seo.ts';

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

const duplicate = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const readyTools = TOOL_MANIFEST.filter((tool) => tool.isReady);
const unreadyTools = TOOL_MANIFEST.filter((tool) => !tool.isReady);
const ids = TOOLS_REGISTRY.map((tool) => tool.id);
const registryRoutes = TOOLS_REGISTRY.flatMap((tool) => [tool.path, ...(tool.aliases ?? [])]);
const manifestShape = TOOL_MANIFEST.map((tool) => `${tool.id}|${tool.path}|${tool.isReady}`);
const registryShape = TOOLS_REGISTRY.map((tool) => `${tool.id}|${tool.path}|${tool.isReady}`);

if (duplicate(ids).length) fail('duplicate tool ids', duplicate(ids));
if (duplicate(registryRoutes).length) fail('duplicate canonical/alias routes', duplicate(registryRoutes));
if (TOOL_MANIFEST.length !== TOOLS_REGISTRY.length || manifestShape.some((value, index) => value !== registryShape[index])) {
  fail('manifest/registry contract drift', [`manifest=${TOOL_MANIFEST.length}`, `registry=${TOOLS_REGISTRY.length}`]);
}

// The registry is the source of truth. Every ready tool must resolve through the
// same canonical localized route resolver for every supported locale.
for (const tool of readyTools) {
  if (getToolConfig(tool.id)?.id !== tool.id) fail('registry resolver ownership drift', [`missing=${tool.id}`]);
  for (const locale of LOCALES) {
    const localizedPath = getToolPath(tool, locale);
    const expectedPrefix = `/${locale}/`;
    if (!localizedPath.startsWith(expectedPrefix)) fail('localized route resolver drift', [`${tool.id}@${locale}`, localizedPath]);
    if (localizedPath.includes('//')) fail('localized route contains duplicate slash', [`${tool.id}@${locale}`, localizedPath]);
  }
}

// Every ready tool × locale must have an exact SEO binding to the canonical route,
// complete hreflang symmetry, and the canonical x-default target.
const seoExpectedCount = readyTools.length * LOCALES.length;
let seoChecked = 0;
for (const tool of readyTools) {
  for (const locale of LOCALES) {
    const expectedPath = getToolPath(tool, locale);
    const seo = getToolSeo(locale, tool.id);
    if (!seo) fail('SEO ownership drift', [`missing SEO model for ${tool.id}@${locale}`]);
    const expectedUrl = new URL(expectedPath, `${canonicalOrigin}/`).toString();
    if (seo.url !== expectedUrl) fail('SEO route drift', [`${tool.id}@${locale}`, `expected=${expectedUrl}`, `actual=${seo.url}`]);
    if (seo.languageTag !== LOCALE_METADATA[locale].languageTag) fail('SEO language drift', [`${tool.id}@${locale}`]);
    if (seo.direction !== LOCALE_METADATA[locale].direction) fail('SEO direction drift', [`${tool.id}@${locale}`]);
    if (!seo.title.trim() || !seo.description.trim()) fail('SEO content missing', [`${tool.id}@${locale}`]);
    if (seo.alternates.length !== LOCALES.length) fail('SEO hreflang cardinality drift', [`${tool.id}@${locale}`, `expected=${LOCALES.length}`, `actual=${seo.alternates.length}`]);

    const alternateLanguages = seo.alternates.map((alternate) => alternate.languageTag);
    if (new Set(alternateLanguages).size !== LOCALES.length) fail('SEO hreflang duplicate languages', [`${tool.id}@${locale}`]);
    for (const alternateLocale of LOCALES) {
      const alternate = seo.alternates.find((entry) => entry.locale === alternateLocale);
      if (!alternate) fail('SEO hreflang missing locale', [`${tool.id}@${locale}`, `missing=${alternateLocale}`]);
      const expectedAlternateUrl = new URL(getToolPath(tool, alternateLocale), `${canonicalOrigin}/`).toString();
      if (alternate.url !== expectedAlternateUrl) fail('SEO hreflang route drift', [`${tool.id}@${locale}`, `alternate=${alternateLocale}`, `expected=${expectedAlternateUrl}`, `actual=${alternate.url}`]);
    }

    const expectedXDefault = new URL(getToolPath(tool, 'en'), `${canonicalOrigin}/`).toString();
    if (seo.xDefaultUrl !== expectedXDefault) fail('SEO x-default drift', [`${tool.id}@${locale}`, `expected=${expectedXDefault}`, `actual=${seo.xDefaultUrl}`]);
    seoChecked += 1;
  }
}

const temp = mkdtempSync(join(tmpdir(), 'flixo-g1-'));
let staticServer;
try {
  run('production build', 'npm', ['run', 'build'], { VITE_SITE_URL: canonicalOrigin });
  run('static ready-route entries', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/generate-static-route-entries.mjs'], { FLIXO_DIST_DIR: 'dist' });

  const distRoot = normalize(join(process.cwd(), 'dist'));
  const contentType = (filePath) => {
    const extension = extname(filePath).toLowerCase();
    return ({
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
    })[extension] ?? 'application/octet-stream';
  };

  staticServer = createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const relativePath = requestPath.replace(/^\/+|\/+$/gu, '');
    const candidate = normalize(join(distRoot, relativePath, relativePath ? 'index.html' : 'index.html'));
    const relativeCandidate = relative(distRoot, candidate);
    if (relativeCandidate.startsWith(`..${sep}`) || relativeCandidate === '..' || relativeCandidate.includes(`${sep}..${sep}`)) {
      response.writeHead(400);
      response.end('Bad Request');
      return;
    }
    if (!existsSync(candidate) || !statSync(candidate).isFile()) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType(candidate) });
    if (request.method === 'HEAD') response.end();
    else createReadStream(candidate).pipe(response);
  });

  const port = await new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => resolve(staticServer.address().port));
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  const requestStatus = async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
    return response.status;
  };

  for (const locale of LOCALES) {
    if (await requestStatus(`/${locale}`) !== 200) fail('localized home route is not publicly reachable', [locale]);
    for (const tool of readyTools) {
      const path = getToolPath(tool, locale);
      const status = await requestStatus(path);
      if (status !== 200) fail('ready localized route is not HTTP 200', [`${tool.id}@${locale}`, path, `status=${status}`]);
    }
  }

  if (!unreadyTools.length) fail('G1 requires at least one non-ready tool to prove the 404 contract');
  for (const locale of LOCALES) {
    for (const tool of unreadyTools) {
      const path = getToolPath(tool, locale);
      const status = await requestStatus(path);
      if (status !== 404) fail('unready localized route is publicly reachable', [`${tool.id}@${locale}`, path, `status=${status}`]);
    }
    const unknownPath = `/${locale}/__g1_unknown_tool__`;
    const unknownStatus = await requestStatus(unknownPath);
    if (unknownStatus !== 404) fail('unknown localized route is publicly reachable', [unknownPath, `status=${unknownStatus}`]);
  }

  run('sitemap generation', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/generate-sitemap.mjs'], { VITE_SITE_URL: canonicalOrigin, FLIXO_GENERATED_OUTPUT_DIR: temp });
  run('robots generation', process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/generate-robots.mjs'], { VITE_SITE_URL: canonicalOrigin, FLIXO_GENERATED_OUTPUT_DIR: temp });

  const sitemap = readFileSync(join(temp, 'sitemap.xml'), 'utf8');
  const robots = readFileSync(join(temp, 'robots.txt'), 'utf8');
  const expectedUrls = new Set(LOCALES.flatMap((locale) => [
    `/${locale}`,
    ...readyTools.map((tool) => getToolPath(tool, locale)),
  ].map((route) => new URL(route, `${canonicalOrigin}/`).toString()));

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  const actualUrls = new Set(locs);
  if (locs.length !== actualUrls.size) fail('duplicate sitemap URLs detected');

  const missing = [...expectedUrls].filter((url) => !actualUrls.has(url));
  const unexpected = [...actualUrls].filter((url) => !expectedUrls.has(url));
  if (missing.length || unexpected.length || expectedUrls.size !== actualUrls.size) {
    fail('sitemap registry drift', [
      `expected=${expectedUrls.size}`,
      `actual=${actualUrls.size}`,
      ...missing.slice(0, 10).map((url) => `missing=${url}`),
      ...unexpected.slice(0, 10).map((url) => `unexpected=${url}`),
    ]);
  }

  const expectedHreflangs = [...LOCALES.map((locale) => LOCALE_METADATA[locale].languageTag), 'x-default'];
  for (const url of actualUrls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const block = sitemap.match(new RegExp(`<url>\\s*<loc>${escaped}<\\/loc>([\\s\\S]*?)<\\/url>`, 'u'));
    if (!block) fail('missing sitemap URL block', [url]);
    const hreflangs = [...block[1].matchAll(/hreflang="([^"]+)"/gu)].map((match) => match[1]);
    if (hreflangs.length !== expectedHreflangs.length || expectedHreflangs.some((lang) => !hreflangs.includes(lang))) {
      fail('sitemap hreflang drift', [url, `expectedLanguages=${expectedHreflangs.join(',')}`, `actualCount=${hreflangs.length}`]);
    }
  }

  if (!robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) fail('robots is not bound to canonical sitemap');
  if (/localhost|127\.0\.0\.1|canonical\.test|git-main-|flexo1\.vercel\.app/iu.test(`${sitemap}\n${robots}`)) {
    fail('preview/test origin leaked into discovery artifacts');
  }
} finally {
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}

console.log(`G1 PLATFORM CONTRACT PASSED: registry=${TOOLS_REGISTRY.length}, ready=${readyTools.length}, unready=${unreadyTools.length}, locales=${LOCALES.length}, seoBindings=${seoChecked}/${seoExpectedCount}, sitemap=${LOCALES.length * (readyTools.length + 1)}, canonical=${canonicalOrigin}, httpReady=${readyTools.length * LOCALES.length}, http404=${unreadyTools.length * LOCALES.length}`);