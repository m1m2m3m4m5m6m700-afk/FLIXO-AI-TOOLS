import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const fail = (message) => {
  console.error(`S3 STATIC GATE FAILED: ${message}`);
  process.exit(1);
};
const pass = (message) => console.log(`S3 STATIC GATE PASS: ${message}`);
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const expectedOrigin = process.env.VITE_SITE_URL;
if (!expectedOrigin) fail('VITE_SITE_URL is required.');
if (expectedOrigin !== 'https://flixoai.vercel.app') fail(`VITE_SITE_URL must be https://flixoai.vercel.app, received ${expectedOrigin}`);

for (const file of ['dist/index.html', 'dist/robots.txt', 'dist/sitemap.xml', 'dist/_flixo_build_manifest.json']) {
  if (!existsSync(resolve(root, file))) fail(`missing build artifact: ${file}`);
}
pass('required build artifacts present');

const robots = read('dist/robots.txt');
if (!robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`)) fail('robots.txt does not point to canonical sitemap.');
if (/https?:\/\/(?:[^\s/]+\.)?vercel\.app/i.test(robots) && !robots.includes(expectedOrigin)) fail('robots.txt contains a non-canonical Vercel origin.');
pass('robots canonical origin contract');

const sitemap = read('dist/sitemap.xml');
if (!sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) fail('sitemap missing XHTML namespace for hreflang.');
if (!sitemap.includes('hreflang="x-default"')) fail('sitemap missing x-default hreflang.');
if (/https?:\/\/(?:[^\s/]+\.)?vercel\.app/i.test(sitemap) && !sitemap.includes(expectedOrigin)) fail('sitemap contains a non-canonical Vercel origin.');
pass('sitemap canonical origin contract');

const manifest = JSON.parse(read('dist/_flixo_build_manifest.json'));
if (!manifest.sha && !manifest.commit_sha) fail('build manifest missing commit SHA.');
pass('immutable build manifest present');

const entryCandidates = ['dist/assets/index.js', 'dist/assets/index-*.js'];
let entryBytes = 0;
for (const candidate of entryCandidates) {
  try {
    const files = execFileSync('bash', ['-lc', `compgen -G '${candidate}' || true`], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
    for (const file of files) entryBytes = Math.max(entryBytes, readFileSync(resolve(root, file)).byteLength);
  } catch {}
}
if (entryBytes > 900 * 1024) fail(`critical JavaScript bundle exceeds 900 KiB (${(entryBytes / 1024).toFixed(1)} KiB)`);
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
  '.github/workflows/ci.yml', '.github/workflows/full-matrix-promotion.yml', '.github/workflows/full-matrix-parallel.yml', '.github/workflows/root-cause-diagnostics.yml', '.github/workflows/s4-runtime-e2e.yml', '.github/workflows/localization-20.yml', '.github/workflows/parallel-diagnostics.yml', '.github/workflows/localization-core.yml', '.github/workflows/phase3-chain-e2e.yml', '.github/workflows/phase3-chain-compatibility.yml', '.github/workflows/seo-production-certification.yml', '.github/workflows/ci-slo-report.yml', '.github/workflows/release-certification.yml', '.github/workflows/g2-file-safety.yml', '.github/workflows/g3-artifact-integrity.yml',
  'eslint.config.js', 'playwright.config.ts', 'vercel.json', 'scripts/ci/architecture-benchmark.mjs', 'scripts/ci/change-risk-planner.mjs', 'scripts/ci/evidence-ledger.mjs', 'scripts/ci/weighted-shard-plan.mjs', 'scripts/ci/write-build-artifact-manifest.mjs', 'scripts/ci/write-evidence-ledger.mjs', 'scripts/ci/ci-slo-report.mjs', 'scripts/ci/validate-full-matrix-evidence.mjs',
  'scripts/validate-ci-contract.mjs', 'scripts/validate-architecture.mjs', 'scripts/validate-architecture-v2.mjs', 'scripts/ci/validate-architecture.mjs', 'scripts/ci/validate-architecture-v2.mjs', 'scripts/validate-s3-static-gate.mjs', 'scripts/verify-contracts-core.mjs', 'scripts/validate-s4-e2e.mjs', 'scripts/validate-site-origin.mjs', 'scripts/validate-production-certification.mjs', 'scripts/validation-contracts.mjs',
  'scripts/test-platform-contract.mjs', 'scripts/generate-static-route-entries.mjs', 'scripts/test-route-resolver.mjs', 'scripts/test-i18n-contract.mjs', 'scripts/test-seo-contract.mjs', 'scripts/test-g2-file-safety.mjs', 'scripts/test-g3-artifact-integrity.mjs', 'scripts/test-g3-output-contract-registry.mjs', 'scripts/validate-language-quality.mjs', 'scripts/validate-language-quality-strict.mjs', 'scripts/validate-locale-contract.mjs', 'scripts/validate-localization-complete.mjs', 'scripts/validation-utils.mjs', 'scripts/validate-indexing.mjs', 'scripts/validate-google-multilingual-seo.mjs', 'scripts/validate-seo-production.mjs', 'scripts/node-resolver-loader.mjs', 'scripts/register-node-resolver.mjs', 'scripts/generate-robots.mjs', 'scripts/generate-sitemap.mjs',
  'src/lib/contracts/pdf-output.ts', 'src/lib/contracts/upload-boundary.ts', 'src/lib/contracts/file-safety.ts', 'src/lib/contracts/output-integrity.ts', 'src/lib/contracts/tool-output.ts', 'src/lib/contracts/tool-output-contracts.ts',
  'src/tools/image-compressor/output-contract.ts', 'src/tools/exif-cleaner/output-contract.ts', 'src/tools/image-converter/output-contract.ts', 'src/tools/image-cropper/output-contract.ts', 'src/tools/image-to-svg/output-contract.ts', 'src/tools/watermark-adder/output-contract.ts', 'src/tools/watermark-remover/output-contract.ts',
  'tests/exif-cleaner.spec.ts', 'tests/exif-cleaner-output-integrity.spec.ts', 'tests/helpers/image-tool-fixture.ts', 'tests/image-converter.spec.ts', 'tests/image-cropper.spec.ts', 'tests/image-to-svg.spec.ts', 'tests/watermark-adder.spec.ts', 'tests/watermark-remover.spec.ts', 'tests/image-compressor.spec.ts', 'tests/g3-artifact-integrity.spec.ts', 'tests/localization-runtime.spec.ts', 'tests/image-converter.contract.spec.ts',
  'src/main.tsx', 'src/home-modern.css', 'src/config/tool-manifest.ts', 'src/config/origin.config.ts', 'src/lib/i18n/config.ts', 'src/lib/i18n/home-loader.ts', 'src/lib/i18n/locale-quality-overrides.ts', 'src/lib/i18n/tool-seo-localization.ts', 'src/lib/routing/route-resolver.ts', 'src/lib/seo/tool-seo.ts', 'src/routes/__root.tsx', 'src/routes/home-page.tsx', 'src/routes/localized-home.tsx', 'src/routes/locale-pages.tsx', 'src/routes/use-case.tsx', 'src/routes/localized-quickflow.tsx', 'src/data/home-locales.ts', 'src/data/quickflow-locales.ts', 'src/data/tool-ui-i18n.ts', 'src/components/FlixoGlobalLogo.tsx', 'src/components/auto-localized-tool-surface.tsx', 'src/tools/image-toolkit/index.tsx', 'src/tools/image-compressor/index.tsx', 'src/config/tool-definitions/image.ts', 'src/tools/pix/index.tsx', 'src/routes/route-tree.ts', 'public/favicon.svg', 'public/flixo-logo.svg', 'public/flixo-logo.jpg', 'public/logo.svg', 'public/logo.jpg', 'index.html', '.env.example', '.gitleaks.toml',
  'README.md', 'README', 'docs/CONSOLIDATION-LOG.md', 'docs/DEBT-REGISTER.md', 'docs/engineering/pr-445-decomposition.md', 'ci/INTEGRATION-BLOCKER.md', 'ci/README.md', 'ci/V5-V10-STATUS.md', 'ci/architecture-plan.md', 'ci/test-duration-history.json', 'package.json', 'release/finalization/C5_PLACEHOLDER.md', 'release/finalization/README.md', 'release/finalization/final_execution_manifest.json', 'release/finalization/final_verification.json',
  'evidence/c4/bundle_metric.json', 'evidence/c4/dag_manifest.pre_c4.json', 'evidence/c4/e2e_aggregate_report.json', 'evidence/c4/environment_fingerprint.json', 'evidence/c4/server_execution.log', 'evidence/c4/server_process_identity.json',
  'src/routes/localized-tool-page.tsx',
]);
const allowLocalizedSeo = (file) => file.startsWith('src/tools/') && file.includes('/seo/') && /\/seo\/[a-z]{2}\.ts$/u.test(file);
const unexpected = changed.filter((file) => !exactAllow.has(file) && !allowLocalizedSeo(file));
if (unexpected.length) fail(`changed-files allowlist violation: ${unexpected.join(', ')}`);
pass(`changed-files allowlist (${changed.length} file(s))`);

const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) fail(`working tree is not clean:\n${dirty}`);
pass('working tree clean');
pass('S3 STATIC GATE COMPLETE');
