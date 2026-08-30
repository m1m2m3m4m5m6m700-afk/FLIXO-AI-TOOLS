import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const fail = (message) => { console.error(`S3 FAIL: ${message}`); process.exit(1); };
const pass = (message) => console.log(`S3 PASS: ${message}`);
const run = (command, args = [], env = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
const runNode = (script) => run('node', ['--import=./scripts/register-node-resolver.mjs', script]);

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (pkg.type !== 'module') fail('package.json must declare type=module');
for (const script of ['typecheck', 'lint', 'build']) if (!pkg.scripts?.[script]) fail(`required static script is missing: ${script}`);
pass('package contract');

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) fail('index.html is missing');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('id="root"')) fail('root entrypoint is missing');
if (!indexHtml.includes('src="/src/main.tsx"') || !existsSync(join(root, 'src/main.tsx'))) fail('canonical /src/main.tsx entrypoint is missing');
pass('entrypoint validation');

const manifestPath = join(root, 'public/manifest.webmanifest');
if (!existsSync(manifestPath)) fail('public/manifest.webmanifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) if (!(key in manifest)) fail(`manifest missing ${key}`);
if (!Array.isArray(manifest.icons) || !manifest.icons.length) fail('manifest icons are empty');
for (const icon of manifest.icons) if (!icon?.src || !existsSync(join(root, 'public', icon.src.replace(/^\//, '')))) fail(`manifest icon is missing: ${icon?.src ?? '<empty>'}`);
pass('manifest validation');

const brandFiles = [
  ['canonical master', 'public/flixo-logo.jpg'],
  ['canonical logo', 'public/flixo-logo.svg'],
  ['logo alias', 'public/logo.svg'],
  ['favicon alias', 'public/favicon.svg'],
  ['global logo component', 'src/components/FlixoGlobalLogo.tsx'],
];
for (const [label, file] of brandFiles) if (!existsSync(join(root, file))) fail(`${label} is missing: ${file}`);
const master = readFileSync(join(root, 'public/flixo-logo.jpg'));
if (master.length < 4096 || master[0] !== 0xff || master[1] !== 0xd8 || master[2] !== 0xff) fail('canonical FLIXO master artwork is invalid');
const logo = readFileSync(join(root, 'public/flixo-logo.svg'), 'utf8');
const alias = readFileSync(join(root, 'public/logo.svg'), 'utf8');
const favicon = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
const globalLogo = readFileSync(join(root, 'src/components/FlixoGlobalLogo.tsx'), 'utf8');
if (!logo.includes('FLIXO AI Tools') || !logo.includes('href="/flixo-logo.jpg"')) fail('canonical logo contract failed');
for (const [label, source] of [['logo.svg', alias], ['favicon.svg', favicon]]) {
  if (!source.includes('href="/flixo-logo.svg"')) fail(`${label} must reference canonical /flixo-logo.svg`);
  if (/<(?:path|linearGradient|radialGradient|filter)\b/u.test(source)) fail(`${label} contains duplicate logo geometry`);
}
if (!globalLogo.includes('src="/flixo-logo.svg"')) fail('FlixoGlobalLogo must use canonical /flixo-logo.svg');
if (!indexHtml.includes('href="/favicon.svg"') || !indexHtml.includes('href="/logo.svg"') || !indexHtml.includes('href="/flixo-logo.svg"')) fail('index.html canonical icon contract failed');
pass('canonical FLIXO brand contract');

run('npm', ['run', 'typecheck']);
pass('TypeScript');
run('npm', ['run', 'lint']);
pass('ESLint');

const siteUrl = process.env.VITE_SITE_URL?.trim() || (process.env.GITHUB_ACTIONS === 'true' ? 'https://canonical.test' : '');
if (!siteUrl) fail('production S3 certification requires VITE_SITE_URL');
run('npm', ['run', 'validate:site-origin'], { VITE_SITE_URL: siteUrl });
if (process.env.FLIXO_BUILD_ARTIFACT === 'true') {
  if (!existsSync(join(dist, '_flixo_build_manifest.json'))) fail('immutable build manifest is missing from dist');
  const buildManifest = JSON.parse(readFileSync(join(dist, '_flixo_build_manifest.json'), 'utf8'));
  if (buildManifest.sha !== process.env.GITHUB_SHA) fail(`build artifact SHA mismatch: ${buildManifest.sha} != ${process.env.GITHUB_SHA}`);
  pass(`verified immutable build artifact for ${buildManifest.sha}`);
} else {
  run('npm', ['run', 'build'], { VITE_SITE_URL: siteUrl, FLIXO_GENERATED_OUTPUT_DIR: 'dist' });
  pass(`production build for ${siteUrl}`);
}

for (const file of ['robots.txt', 'sitemap.xml']) if (!existsSync(join(dist, file))) fail(`build output is missing dist/${file}`);
const expectedRobots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
if (readFileSync(join(dist, 'robots.txt'), 'utf8') !== expectedRobots) fail('dist/robots.txt does not match canonical origin contract');
pass('deployment metadata');
runNode('scripts/validate-google-multilingual-seo.mjs');
pass('Google multilingual SEO contract');
runNode('scripts/validate-language-quality-strict.mjs');
pass('strict 20-locale localization quality');

const outputDir = existsSync(join(dist, 'client')) ? join(dist, 'client') : dist;
const outputIndex = join(outputDir, 'index.html');
if (!existsSync(outputIndex)) fail('built index.html is missing');
const outputReal = realpathSync(outputDir);
const symlinkEscapes = [];
const scan = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const full = join(dir, entry.name); if (entry.isSymbolicLink()) { try { const target = realpathSync(full); const rel = relative(outputReal, target); if (rel.startsWith('..') || resolve(outputReal, rel) !== target) symlinkEscapes.push(full); } catch { symlinkEscapes.push(`${full} (dangling)`); } } else if (entry.isDirectory()) scan(full); } };
scan(outputDir);
if (symlinkEscapes.length) fail(`dist contains symlink escapes: ${symlinkEscapes.join(', ')}`);
pass('realpath containment');

const normalize = (value) => value.split(/[?#]/u, 1)[0].replace(/^\/+/, '');
const scripts = [...readFileSync(outputIndex, 'utf8').matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/giu)].map((m) => normalize(m[1]));
if (!scripts.length || scripts.length !== new Set(scripts).size) fail('built index module entrypoints are missing or duplicated');
const assetPath = (ref) => { const n = normalize(ref); return [join(outputDir, n), join(outputDir, `${n}.js`)].find(existsSync) ?? null; };
const visited = new Set();
const queue = scripts.map((ref) => ({ ref, from: 'index.html' }));
const imports = /(?:\bimport\s*(?:[^'"()]*?\sfrom\s*)?|\bimport\s*\(\s*)["']([^"']+)["']/gu;
while (queue.length) {
  const { ref, from } = queue.pop();
  const file = assetPath(ref);
  if (!file) fail(`built JS entrypoint is missing: ${ref}`);
  const canonical = realpathSync(file);
  if (visited.has(canonical)) continue;
  visited.add(canonical);
  for (const match of readFileSync(file, 'utf8').matchAll(imports)) {
    const spec = match[1];
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    const relBase = relative(outputDir, file).split(/\\|\//u).slice(0, -1).join('/');
    const child = spec.startsWith('/') ? normalize(spec) : normalize(join(relBase, spec));
    if (!assetPath(child)) fail(`unresolved local JS import ${spec} from ${from}`);
    queue.push({ ref: child, from: file });
  }
}
pass(`unique JS graph (${visited.size} reachable module file(s))`);

const budget = 900 * 1024;
const entryBytes = scripts.reduce((sum, ref) => { const file = assetPath(ref); if (!file) fail(`critical JS asset missing: ${ref}`); return sum + lstatSync(file).size; }, 0);
if (entryBytes > budget) fail(`critical JavaScript budget exceeded: ${(entryBytes / 1024).toFixed(1)} KiB > 900.0 KiB`);
pass(`critical JavaScript <= 900 KiB (${(entryBytes / 1024).toFixed(1)} KiB)`);

const base = process.env.S3_BASE_REF || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
let changedRaw = '';
try {
  changedRaw = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  try {
    changedRaw = execFileSync('git', ['diff', '--name-only', `${base}..HEAD`], { cwd: root, encoding: 'utf8' }).trim();
    console.log(`S3 BASE FALLBACK: ${base} has no merge base; using direct two-tree diff ${base}..HEAD.`);
  } catch (error) {
    fail(`unable to evaluate changed-files allowlist against ${base}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const changed = changedRaw ? changedRaw.split('\n').filter(Boolean) : [];
const exactAllow = new Set([
  '.github/workflows/ci.yml', '.github/workflows/full-matrix-promotion.yml', '.github/workflows/root-cause-diagnostics.yml', '.github/workflows/s4-runtime-e2e.yml', '.github/workflows/localization-20.yml', '.github/workflows/parallel-diagnostics.yml', '.github/workflows/localization-core.yml', '.github/workflows/phase3-chain-e2e.yml', '.github/workflows/phase3-chain-compatibility.yml', '.github/workflows/seo-production-certification.yml', '.github/workflows/ci-slo-report.yml',
  '.github/workflows/g1-platform-contract.yml',
  '.gitleaks.toml',
  'eslint.config.js', 'playwright.config.ts', 'scripts/ci/architecture-benchmark.mjs', 'scripts/ci/change-risk-planner.mjs', 'scripts/ci/evidence-ledger.mjs', 'scripts/ci/weighted-shard-plan.mjs', 'scripts/ci/write-build-artifact-manifest.mjs', 'scripts/ci/write-evidence-ledger.mjs', 'scripts/ci/ci-slo-report.mjs', 'scripts/ci/validate-full-matrix-evidence.mjs',
  'scripts/validate-ci-contract.mjs', 'scripts/validate-architecture.mjs', 'scripts/validate-architecture-v2.mjs', 'scripts/ci/validate-architecture.mjs', 'scripts/ci/validate-architecture-v2.mjs', 'scripts/validate-s3-static-gate.mjs', 'scripts/verify-contracts-core.mjs', 'scripts/validate-s4-e2e.mjs', 'scripts/validate-site-origin.mjs',
  'scripts/test-platform-contract.mjs',
  'scripts/test-route-resolver.mjs', 'scripts/test-i18n-contract.mjs', 'scripts/test-seo-contract.mjs', 'scripts/validate-language-quality.mjs', 'scripts/validate-language-quality-strict.mjs', 'scripts/validate-locale-contract.mjs', 'scripts/validate-localization-complete.mjs', 'scripts/validation-utils.mjs', 'scripts/validate-indexing.mjs', 'scripts/validate-google-multilingual-seo.mjs', 'scripts/validate-seo-production.mjs', 'scripts/node-resolver-loader.mjs', 'scripts/register-node-resolver.mjs', 'scripts/generate-robots.mjs', 'scripts/generate-sitemap.mjs',
  'README.md', 'README', 'docs/CONSOLIDATION-LOG.md', 'docs/DEBT-REGISTER.md', 'docs/engineering/pr-445-decomposition.md', 'ci/INTEGRATION-BLOCKER.md', 'ci/README.md', 'ci/V5-V10-STATUS.md', 'ci/architecture-plan.md', 'ci/test-duration-history.json', 'package.json', 'release/finalization/C5_PLACEHOLDER.md', 'release/finalization/README.md', 'release/finalization/final_execution_manifest.json', 'release/finalization/final_verification.json',
  'src/main.tsx', 'src/home-modern.css', 'src/config/tool-manifest.ts', 'src/config/origin.config.ts', 'src/lib/i18n/config.ts', 'src/lib/i18n/home-loader.ts', 'src/lib/i18n/locale-quality-overrides.ts', 'src/lib/i18n/tool-seo-localization.ts', 'src/lib/routing/route-resolver.ts', 'src/lib/seo/tool-seo.ts', 'src/routes/__root.tsx', 'src/routes/home-page.tsx', 'src/routes/localized-home.tsx', 'src/routes/locale-pages.tsx', 'src/routes/use-case.tsx', 'src/routes/localized-quickflow.tsx', 'src/routes/locale-pages.tsx', 'src/routes/use-case.tsx', 'src/routes/localized-quickflow.tsx', 'src/data/home-locales.ts', 'src/data/quickflow-locales.ts', 'src/data/tool-ui-i18n.ts', 'src/components/FlixoGlobalLogo.tsx', 'src/components/auto-localized-tool-surface.tsx', 'src/lib/contracts/upload-boundary.ts', 'src/lib/contracts/file-safety.ts', 'src/lib/contracts/output-integrity.ts',
  'src/tools/image-toolkit/index.tsx', 'src/tools/image-compressor/index.tsx', 'src/tools/image-compressor/output-contract.ts', 'tests/image-converter.contract.spec.ts', 'tests/localization-runtime.spec.ts', 'public/favicon.svg', 'public/flixo-logo.svg', 'public/flixo-logo.jpg', 'public/logo.svg', 'public/logo.jpg', 'index.html', '.env.example',
  'evidence/c4/bundle_metric.json', 'evidence/c4/dag_manifest.pre_c4.json', 'evidence/c4/server_execution.log', 'evidence/c4/server_process_identity.json',
  'src/routes/localized-tool.tsx',
]);
const allowLocalizedSeo = (file) => file.startsWith('src/tools/') && file.includes('/seo/') && /\/seo\/[a-z]{2}\.ts$/u.test(file);
const unexpected = changed.filter((file) => !exactAllow.has(file) && !allowLocalizedSeo(file));
if (unexpected.length) fail(`changed-files allowlist violation: ${unexpected.join(', ')}`);
pass(`changed-files allowlist (${changed.length} file(s))`);

const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) fail(`working tree is not clean:\n${dirty}`);
pass('working tree clean');
pass('S3 STATIC GATE COMPLETE');
