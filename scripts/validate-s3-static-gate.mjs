import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const generatedSitemapPath = join(root, 'public/sitemap.xml');
const sitemapExistedBeforeBuild = existsSync(generatedSitemapPath);
const fail = (message) => {
  console.error(`S3 FAIL: ${message}`);
  process.exit(1);
};
const pass = (message) => console.log(`S3 PASS: ${message}`);
const run = (command, args = []) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (packageJson.type !== 'module') fail('package.json must declare type=module');
if (!packageJson.scripts?.typecheck || !packageJson.scripts?.lint || !packageJson.scripts?.build) fail('required static scripts are missing');
pass('package contract');

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) fail('index.html is missing');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('id="root"')) fail('root entrypoint is missing');
if (!indexHtml.includes('src="/src/main.tsx"')) fail('canonical /src/main.tsx entrypoint is missing');
if (!existsSync(join(root, 'src/main.tsx'))) fail('src/main.tsx does not exist');
pass('entrypoint validation');

const manifestPath = join(root, 'public/manifest.webmanifest');
if (!existsSync(manifestPath)) fail('public/manifest.webmanifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) if (!(key in manifest)) fail(`manifest missing ${key}`);
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) fail('manifest icons are empty');
for (const icon of manifest.icons) {
  const iconPath = icon?.src ? join(root, 'public', icon.src.replace(/^\//, '')) : '';
  if (!icon?.src || !existsSync(iconPath)) fail(`manifest icon is missing: ${icon?.src ?? '<empty>'}`);
}
pass('manifest validation');

run('npm', ['run', 'typecheck']);
pass('TypeScript');
run('npm', ['run', 'lint']);
pass('ESLint');
run('npm', ['run', 'build']);
pass('production build');
if (!sitemapExistedBeforeBuild && existsSync(generatedSitemapPath)) {
  unlinkSync(generatedSitemapPath);
  pass('removed build-generated public/sitemap.xml');
}

const outputDir = existsSync(join(dist, 'client')) ? join(dist, 'client') : dist;
const outputIndex = join(outputDir, 'index.html');
if (!existsSync(outputIndex)) fail('built index.html is missing');
const outputReal = realpathSync(outputDir);
const realPathViolations = [];
const visitSymlinks = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const target = realpathSync(full);
        const rel = relative(outputReal, target);
        if (rel.startsWith('..') || resolve(outputReal, rel) !== target) realPathViolations.push(full);
      } catch { realPathViolations.push(`${full} (dangling)`); }
    } else if (entry.isDirectory()) visitSymlinks(full);
  }
};
visitSymlinks(outputDir);
if (realPathViolations.length) fail(`dist contains symlink escapes: ${realPathViolations.join(', ')}`);
pass('realpath containment');

const normalizeAsset = (value) => value.split(/[?#]/u, 1)[0].replace(/^\/+/, '');
const scriptRefs = [...readFileSync(outputIndex, 'utf8').matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/giu)].map((m) => normalizeAsset(m[1]));
if (scriptRefs.length === 0) fail('no module entrypoint found in built index.html');
if (scriptRefs.length !== new Set(scriptRefs).size) fail('duplicate module script references in built index.html');
const assetPath = (reference) => {
  const normalized = normalizeAsset(reference);
  const candidates = [join(outputDir, normalized), join(outputDir, `${normalized}.js`)];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
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
pass(`unique JS graph (${visited.size} reachable module file(s))`);

const criticalBudgetBytes = 900 * 1024;
let criticalJavascriptBytes = 0;
const criticalAssets = [];
for (const ref of scriptRefs) {
  const file = assetPath(ref);
  if (!file) fail(`critical JS asset is missing: ${ref}`);
  const bytes = lstatSync(file).size;
  criticalJavascriptBytes += bytes;
  criticalAssets.push({ path: relative(outputDir, file).replaceAll('\\', '/'), bytes });
}
console.log(`S3 CRITICAL JS: ${(criticalJavascriptBytes / 1024).toFixed(1)} KiB across ${criticalAssets.length} entry asset(s)`);
for (const asset of criticalAssets) console.log(`  critical ${asset.path} ${(asset.bytes / 1024).toFixed(1)} KiB`);
if (criticalJavascriptBytes > criticalBudgetBytes) fail(`critical JavaScript budget exceeded: ${(criticalJavascriptBytes / 1024).toFixed(1)} KiB > 900.0 KiB`);
pass('critical JavaScript <= 900 KiB');

const base = process.env.S3_BASE_REF ?? 'origin/main';
try {
  const changedRaw = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).trim();
  const changed = changedRaw ? changedRaw.split('\n').filter(Boolean) : [];
  const allow = new Set([
    '.github/workflows/s4-runtime-e2e.yml',
    'playwright.config.ts',
    'scripts/validate-s3-static-gate.mjs',
    'scripts/validate-s4-e2e.mjs',
    'scripts/node-resolver-loader.mjs',
    'scripts/register-node-resolver.mjs',
    'README.md',
    'package.json',
    'release/finalization/C5_PLACEHOLDER.md',
    'release/finalization/README.md',
    'release/finalization/final_execution_manifest.json',
    'release/finalization/final_verification.json',
    'src/main.tsx',
    'src/home-modern.css',
    'src/config/tool-manifest.ts',
    'src/lib/i18n/tool-seo-localization.ts',
  ]);
  const unexpected = changed.filter((file) => !allow.has(file));
  if (unexpected.length) fail(`changed-files allowlist violation: ${unexpected.join(', ')}`);
  pass(`changed-files allowlist (${changed.length} file(s))`);
} catch (error) {
  console.error(error?.message ?? error);
  fail(`unable to evaluate changed-files allowlist against ${base}`);
}

try {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (status) fail(`working tree is not clean:\n${status}`);
  pass('working tree clean');
} catch { fail('unable to inspect git working tree'); }

pass('S3 STATIC GATE COMPLETE');
