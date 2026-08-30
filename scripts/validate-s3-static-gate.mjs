import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`S3 FAIL: ${message}`);
  process.exit(1);
};
const warn = (message) => console.warn(`S3 WARN: ${message}`);

const base = process.env.S3_BASE_REF ?? 'origin/main';
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
  '.github/workflows/ci.yml', '.github/workflows/full-matrix-promotion.yml', '.github/workflows/full-matrix-parallel.yml', '.github/workflows/root-cause-diagnostics.yml', '.github/workflows/s4-runtime-e2e.yml', '.github/workflows/localization-20.yml', '.github/workflows/parallel-diagnostics.yml', '.github/workflows/localization-core.yml', '.github/workflows/phase3-chain-e2e.yml', '.github/workflows/phase3-chain-compatibility.yml', '.github/workflows/seo-production-certification.yml', '.github/workflows/ci-slo-report.yml', '.github/workflows/release-certification.yml',
  'eslint.config.js', 'playwright.config.ts', 'scripts/ci/architecture-benchmark.mjs', 'scripts/ci/change-risk-planner.mjs', 'scripts/ci/evidence-ledger.mjs', 'scripts/ci/weighted-shard-plan.mjs', 'scripts/ci/write-build-artifact-manifest.mjs', 'scripts/ci/write-evidence-ledger.mjs', 'scripts/ci/ci-slo-report.mjs', 'scripts/ci/validate-full-matrix-evidence.mjs',
  'scripts/validate-ci-contract.mjs', 'scripts/validate-architecture.mjs', 'scripts/validate-architecture-v2.mjs', 'scripts/ci/validate-architecture.mjs', 'scripts/ci/validate-architecture-v2.mjs', 'scripts/validate-s3-static-gate.mjs', 'scripts/verify-contracts-core.mjs', 'scripts/validate-s4-e2e.mjs', 'scripts/validate-site-origin.mjs', 'scripts/validate-production-certification.mjs', 'scripts/validation-contracts.mjs',
  'scripts/test-platform-contract.mjs', 'scripts/generate-static-route-entries.mjs', 'scripts/test-route-resolver.mjs', 'scripts/test-i18n-contract.mjs', 'scripts/test-seo-contract.mjs', 'scripts/validate-language-quality.mjs', 'scripts/validate-language-quality-strict.mjs', 'scripts/validate-locale-contract.mjs', 'scripts/validate-localization-complete.mjs', 'scripts/validation-utils.mjs', 'scripts/validate-indexing.mjs', 'scripts/validate-google-multilingual-seo.mjs', 'scripts/validate-seo-production.mjs', 'scripts/node-resolver-loader.mjs', 'scripts/register-node-resolver.mjs', 'scripts/generate-robots.mjs', 'scripts/generate-sitemap.mjs',
  'README.md', 'README', 'docs/CONSOLIDATION-LOG.md', 'docs/DEBT-REGISTER.md', 'docs/engineering/pr-445-decomposition.md', 'ci/INTEGRATION-BLOCKER.md', 'ci/README.md', 'ci/V5-V10-STATUS.md', 'ci/architecture-plan.md', 'ci/test-duration-history.json', 'package.json', 'release/finalization/C5_PLACEHOLDER.md', 'release/finalization/README.md', 'release/finalization/final_execution_manifest.json', 'release/finalization/final_verification.json',
  'src/main.tsx', 'src/home-modern.css', 'src/config/tool-manifest.ts', 'src/config/origin.config.ts', 'src/lib/i18n/config.ts', 'src/lib/i18n/home-loader.ts', 'src/lib/i18n/locale-quality-overrides.ts', 'src/lib/i18n/tool-seo-localization.ts', 'src/lib/routing/route-resolver.ts', 'src/lib/seo/tool-seo.ts', 'src/routes/__root.tsx', 'src/routes/home-page.tsx', 'src/routes/localized-home.tsx', 'src/routes/locale-pages.tsx', 'src/routes/use-case.tsx', 'src/routes/localized-quickflow.tsx', 'src/data/home-locales.ts', 'src/data/quickflow-locales.ts', 'src/data/tool-ui-i18n.ts', 'src/components/FlixoGlobalLogo.tsx', 'src/components/auto-localized-tool-surface.tsx', 'src/lib/contracts/upload-boundary.ts', 'src/lib/contracts/file-safety.ts', 'src/lib/contracts/output-integrity.ts',
  'src/tools/image-toolkit/index.tsx', 'src/tools/image-compressor/index.tsx', 'src/tools/image-compressor/output-contract.ts', 'tests/image-converter.contract.spec.ts', 'tests/localization-runtime.spec.ts', 'public/favicon.svg', 'public/flixo-logo.svg', 'public/flixo-logo.jpg', 'public/logo.svg', 'public/logo.jpg', 'index.html', '.env.example', '.gitleaks.toml',
  'evidence/c4/bundle_metric.json', 'evidence/c4/dag_manifest.pre_c4.json', 'evidence/c4/e2e_aggregate_report.json', 'evidence/c4/environment_fingerprint.json', 'evidence/c4/server_execution.log', 'evidence/c4/server_process_identity.json',
]);
const allowLocalizedSeo = (file) => file.startsWith('src/tools/') && file.includes('/seo/') && /\/seo\/[a-z]{2}\.ts$/u.test(file);
const allowGeneratedEvidence = (file) => file.startsWith('evidence/') && /\.(json|log|txt)$/u.test(file);
const allowGeneratedBuild = (file) => file.startsWith('dist/') && !file.includes('..');

for (const file of changed) {
  if (exactAllow.has(file) || allowLocalizedSeo(file) || allowGeneratedEvidence(file) || allowGeneratedBuild(file)) continue;
  fail(`changed-files allowlist violation: ${file}`);
}

const required = [
  'dist/index.html',
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/_flixo_build_manifest.json',
];
for (const file of required) {
  if (!existsSync(join(root, file))) fail(`required build artifact missing: ${file}`);
}

const manifest = JSON.parse(readFileSync(join(root, 'dist/_flixo_build_manifest.json'), 'utf8'));
if (!manifest.sha && !manifest.commit_sha) warn('build manifest does not expose a commit SHA');

console.log(`S3 STATIC GATE PASSED: changed=${changed.length}, allowlisted=${changed.length}, build=${manifest.sha ?? manifest.commit_sha ?? 'unknown'}`);
