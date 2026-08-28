import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const generatedSitemapPath = join(root, 'public/sitemap.xml');
const generatedRobotsPath = join(root, 'public/robots.txt');
const sitemapExistedBeforeBuild = existsSync(generatedSitemapPath);
const robotsExistedBeforeBuild = existsSync(generatedRobotsPath);
const fail = (message) => { console.error(`S3 FAIL: ${message}`); process.exit(1); };
const pass = (message) => console.log(`S3 PASS: ${message}`);
const run = (command, args = [], extraEnv = {}) => execFileSync(command, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...extraEnv },
});
const runNodeScript = (script, args = []) => run('node', ['--import=./scripts/register-node-resolver.mjs', script, ...args]);

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (packageJson.type !== 'module') fail('package.json must declare type=module');
for (const script of ['typecheck', 'lint', 'build']) {
  if (typeof packageJson.scripts?.[script] !== 'string') fail(`package.json is missing npm script: ${script}`);
}
pass('package contract');

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) fail('index.html is missing');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('id="root"') || !indexHtml.includes('src="/src/main.tsx"')) fail('canonical application entrypoint contract failed');
if (!existsSync(join(root, 'src/main.tsx'))) fail('src/main.tsx is missing');
pass('entrypoint validation');

const manifestPath = join(root, 'public/manifest.webmanifest');
if (!existsSync(manifestPath)) fail('public/manifest.webmanifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) if (!(key in manifest)) fail(`manifest missing ${key}`);
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) fail('manifest icons are empty');
for (const icon of manifest.icons) {
  const src = typeof icon?.src === 'string' ? icon.src : '';
  const iconPath = src ? join(root, 'public', src.replace(/^\//u, '')) : '';
  if (!src || !existsSync(iconPath)) fail(`manifest icon is missing: ${src || '<empty>'}`);
}
pass('manifest validation');

const canonicalMasterPath = join(root, 'public/flixo-logo.jpg');
const canonicalLogoPath = join(root, 'public/flixo-logo.svg');
const logoAliasPath = join(root, 'public/logo.svg');
const faviconPath = join(root, 'public/favicon.svg');
const globalLogoPath = join(root, 'src/components/FlixoGlobalLogo.tsx');
if (!existsSync(canonicalMasterPath)) fail('canonical FLIXO master artwork is missing');
for (const file of [canonicalLogoPath, logoAliasPath, faviconPath, globalLogoPath]) {
  if (!existsSync(file)) fail(`required brand file is missing: ${relative(root, file)}`);
}
const canonicalMaster = readFileSync(canonicalMasterPath);
if (canonicalMaster.length < 4096 || canonicalMaster[0] !== 0xff || canonicalMaster[1] !== 0xd8 || canonicalMaster[2] !== 0xff) fail('canonical FLIXO master artwork is not a valid JPEG of expected size');
const canonicalLogo = readFileSync(canonicalLogoPath, 'utf8');
const logoAlias = readFileSync(logoAliasPath, 'utf8');
const favicon = readFileSync(faviconPath, 'utf8');
const globalLogo = readFileSync(globalLogoPath, 'utf8');
if (!canonicalLogo.includes('FLIXO AI Tools') || !canonicalLogo.includes('href="/flixo-logo.jpg"')) fail('canonical logo contract failed');
for (const [label, source] of [['logo.svg', logoAlias], ['favicon.svg', favicon]]) {
  if (!source.includes('href="/flixo-logo.svg"')) fail(`${label} must reference canonical /flixo-logo.svg`);
  if (/<(?:path|linearGradient|radialGradient|filter)\b/u.test(source)) fail(`${label} contains duplicate logo geometry`);
}
if (!globalLogo.includes('src="/flixo-logo.svg"')) fail('global logo component must use canonical logo');
if (!indexHtml.includes('href="/favicon.svg"') || !indexHtml.includes('href="/logo.svg"') || !indexHtml.includes('href="/flixo-logo.svg"')) fail('index.html brand asset contract failed');
if (!manifest.icons.some((icon) => icon?.src === '/flixo-logo.svg')) fail('manifest must expose canonical logo');
pass('canonical FLIXO brand contract');

run('npm', ['run', 'typecheck']);
pass('TypeScript');
run('npm', ['run', 'lint']);
pass('ESLint');

const siteUrl = process.env.VITE_SITE_URL?.trim();
if (!siteUrl) fail('VITE_SITE_URL is required for S3 production certification; configure repository variable SITE_URL.');
runNodeScript('scripts/validate-site-origin.mjs');
run('npm', ['run', 'build'], { VITE_SITE_URL: siteUrl });
pass('production build');
for (const script of ['scripts/validate-google-multilingual-seo.mjs', 'scripts/validate-language-quality-strict.mjs']) {
  runNodeScript(script);
  pass(relative(root, script));
}
if (!sitemapExistedBeforeBuild && existsSync(generatedSitemapPath)) { unlinkSync(generatedSitemapPath); pass('removed build-generated sitemap artifact'); }
if (!robotsExistedBeforeBuild && existsSync(generatedRobotsPath)) { unlinkSync(generatedRobotsPath); pass('removed build-generated robots artifact'); }

const outputDir = existsSync(join(dist, 'client')) ? join(dist, 'client') : dist;
const outputIndex = join(outputDir, 'index.html');
if (!existsSync(outputIndex)) fail('built index.html is missing');
const outputReal = realpathSync(outputDir);
const escapedSymlinks = [];
const visit = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const target = realpathSync(full);
        const rel = relative(outputReal, target);
        if (rel.startsWith('..') || resolve(outputReal, rel) !== target) escapedSymlinks.push(full);
      } catch {
        escapedSymlinks.push(`${full} (dangling)`);
      }
    } else if (entry.isDirectory()) visit(full);
  }
};
visit(outputDir);
if (escapedSymlinks.length) fail(`dist contains symlink escapes: ${escapedSymlinks.join(', ')}`);
pass('realpath containment');

const normalizeAsset = (value) => value.split(/[?#]/u, 1)[0].replace(/^\/+/, '');
const outputHtml = readFileSync(outputIndex, 'utf8');
const scriptRefs = [...outputHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/giu)].map((m) => normalizeAsset(m[1]));
if (scriptRefs.length === 0) fail('built index.html has no module entrypoint');
if (scriptRefs.length !== new Set(scriptRefs).size) fail('built index.html contains duplicate module entrypoints');
const assetPath = (reference) => {
  const normalized = normalizeAsset(reference);
  return [join(outputDir, normalized), join(outputDir, `${normalized}.js`)].find((candidate) => existsSync(candidate)) ?? null;
};
const visited = new Set();
const pending = scriptRefs.map((ref) => ({ ref, from: 'index.html' }));
const localImportPattern = /(?:\bimport\s*(?:[^'"()]*?\sfrom\s*)?|\bimport\s*\(\s*)["']([^"']+)["']/gu;
while (pending.length) {
  const { ref, from } = pending.pop();
  const file = assetPath(ref);
  if (!file) fail(`built JS entrypoint is missing: ${ref}`);
  const canonical = realpathSync(file);
  if (visited.has(canonical)) continue;
  visited.add(canonical);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(localImportPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
    const baseReference = specifier.startsWith('/')
      ? normalizeAsset(specifier)
      : normalizeAsset(join(relative(outputDir, file).split(/\\|\//u).slice(0, -1).join('/'), specifier));
    if (!assetPath(baseReference)) fail(`unresolved local JS import ${specifier} from ${from}`);
    pending.push({ ref: baseReference, from: file });
  }
}
pass(`unique JS graph (${visited.size} reachable module files)`);

const criticalBudgetBytes = 900 * 1024;
let criticalBytes = 0;
for (const ref of scriptRefs) {
  const file = assetPath(ref);
  if (!file) fail(`critical JS asset is missing: ${ref}`);
  criticalBytes += lstatSync(file).size;
}
console.log(`S3 CRITICAL JS: ${(criticalBytes / 1024).toFixed(1)} KiB`);
if (criticalBytes > criticalBudgetBytes) fail(`critical JavaScript budget exceeded: ${(criticalBytes / 1024).toFixed(1)} KiB > 900.0 KiB`);
pass('critical JavaScript <= 900 KiB');

const base = process.env.S3_BASE_REF ?? 'origin/main';
try {
  const changedRaw = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).trim();
  const changed = changedRaw ? changedRaw.split('\n').filter(Boolean) : [];
  const forbidden = /^(?:\.git(?:\/|$)|node_modules(?:\/|$)|dist(?:\/|$)|coverage(?:\/|$)|playwright-report(?:\/|$)|test-results(?:\/|$)|\.env(?:\.|$))/u;
  const violations = changed.filter((file) => forbidden.test(file));
  if (violations.length) fail(`generated/private artifact changes are forbidden: ${violations.join(', ')}`);
  pass(`changed-file hygiene (${changed.length} file(s))`);
} catch (error) {
  if (error?.message?.startsWith('S3 FAIL:')) throw error;
  console.error(error?.message ?? error);
  fail(`unable to evaluate changed-file hygiene against ${base}`);
}

try {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (status) fail(`working tree is not clean:\n${status}`);
  pass('working tree clean');
} catch {
  fail('unable to inspect git working tree');
}

pass('S3 STATIC GATE COMPLETE');
