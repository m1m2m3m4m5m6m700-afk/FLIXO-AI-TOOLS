import { createHash } from 'node:crypto';

export const ULTRA_SCHEMA_VERSION = 3;
export const ULTRA_SUITES = Object.freeze({
  toolchain: [
    { id: 'typecheck', contract: 'CI-TOOLCHAIN-001', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 120_000 },
    { id: 'lint', contract: 'CI-TOOLCHAIN-002', command: 'npm', args: ['run', 'lint'], timeoutMs: 120_000 },
    { id: 'ci-contract', contract: 'CI-CONFIG-001', command: 'npm', args: ['run', 'validate:ci-contract'], timeoutMs: 120_000 },
  ],
  architecture: [
    { id: 'tool-registry', contract: 'G1-REGISTRY-001', command: 'npm', args: ['run', 'validate:tool-registry'], timeoutMs: 120_000 },
    { id: 'tool-manifest', contract: 'G1-REGISTRY-002', command: 'npm', args: ['run', 'validate:tool-manifest'], timeoutMs: 120_000 },
    { id: 'router-registry', contract: 'G1-ROUTER-001', command: 'npm', args: ['run', 'validate:router-registry'], timeoutMs: 120_000 },
    { id: 'baseline', contract: 'G1-BASELINE-001', command: 'npm', args: ['run', 'validate:baseline'], timeoutMs: 120_000 },
    { id: 'route-resolver', contract: 'G1-ROUTE-001', command: 'npm', args: ['run', 'test:route-resolver'], timeoutMs: 120_000 },
  ],
  localization: [
    { id: 'i18n-strict', contract: 'G4-I18N-001', command: 'npm', args: ['run', 'verify:i18n', '--', '--strict', '--report'], timeoutMs: 180_000 },
    { id: 'locale-integrity', contract: 'G4-I18N-002', command: 'npm', args: ['run', 'validate:locale-integrity'], timeoutMs: 120_000 },
    { id: 'locale-navigation', contract: 'G4-I18N-003', command: 'npm', args: ['run', 'validate:locale-navigation'], timeoutMs: 120_000 },
    { id: 'home-i18n', contract: 'G4-I18N-004', command: 'npm', args: ['run', 'validate:home-i18n'], timeoutMs: 120_000 },
    { id: 'tool-localization', contract: 'G4-I18N-005', command: 'npm', args: ['run', 'test:tool-localization'], timeoutMs: 120_000 },
    { id: 'language-quality', contract: 'G4-I18N-006', command: 'node', args: ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-language-quality-strict.mjs'], timeoutMs: 180_000 },
  ],
  seo: [
    { id: 'seo', contract: 'G1-SEO-001', command: 'npm', args: ['run', 'validate:seo'], timeoutMs: 120_000 },
    { id: 'seo-manifest', contract: 'G1-SEO-002', command: 'npm', args: ['run', 'validate:seo-manifest'], timeoutMs: 120_000 },
    { id: 'use-case-seo', contract: 'G1-SEO-003', command: 'npm', args: ['run', 'validate:use-case-seo'], timeoutMs: 120_000 },
    { id: 'indexing', contract: 'G1-INDEXING-001', command: 'npm', args: ['run', 'validate:indexing'], timeoutMs: 120_000 },
    { id: 'breadcrumb-seo', contract: 'G1-SEO-004', command: 'npm', args: ['run', 'validate:breadcrumb-seo'], timeoutMs: 120_000 },
    { id: 'multilingual-seo', contract: 'G4-SEO-001', command: 'node', args: ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-google-multilingual-seo.mjs'], timeoutMs: 180_000 },
  ],
  security: [
    { id: 'upload-boundary', contract: 'G2-UNSAFE-INPUT-001', command: 'npm', args: ['run', 'test:upload-boundary'], timeoutMs: 120_000 },
    { id: 'file-safety', contract: 'G2-SIGNATURE-001', command: 'node', args: ['--experimental-strip-types', 'scripts/test-file-safety.mjs'], timeoutMs: 180_000 },
  ],
  artifact: [
    { id: 'output-integrity', contract: 'G3-INTEGRITY-001', command: 'node', args: ['--experimental-strip-types', 'scripts/test-output-integrity.mjs'], timeoutMs: 180_000 },
    { id: 'svg-integrity', contract: 'G3-SIGNATURE-001', command: 'node', args: ['--experimental-strip-types', 'scripts/test-svg-integrity.mjs'], timeoutMs: 180_000 },
  ],
  runtime: [
    { id: 'g4-runtime', contract: 'G4-RUNTIME-001', command: 'npx', args: ['playwright', 'test', 'tests/localization-runtime.spec.ts', '--project=chromium', '--workers=4', '--retries=0', '--max-failures=25'], timeoutMs: 600_000 },
  ],
  browser: [
    { id: 'browser-localization', contract: 'G4-BROWSER-001', command: 'npx', args: ['playwright', 'test', 'tests/localization-browser-smoke.spec.ts', '--project=chromium', '--workers=4', '--retries=0', '--max-failures=25'], timeoutMs: 600_000 },
  ],
  build: [
    { id: 'build', contract: 'CI-BUILD-001', command: 'npm', args: ['run', 'build'], timeoutMs: 600_000 },
  ],
});

export const ULTRA_SUITE_NAMES = Object.freeze(Object.keys(ULTRA_SUITES));

export function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function ultraContractHash() {
  return stableHash({ schemaVersion: ULTRA_SCHEMA_VERSION, suites: ULTRA_SUITES });
}

export function normalizeOutput(text) {
  return String(text ?? '')
    .replace(/https?:\/\/[^\s]+/giu, '<URL>')
    .replace(/[0-9a-f]{7,64}/giu, '<SHA>')
    .replace(/\b\d+(?:\.\d+)?\b/gu, '<N>')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(-800);
}

export function suiteContract(suite) {
  const checks = ULTRA_SUITES[suite];
  if (!checks) throw new Error(`Unknown Ultra suite: ${suite}`);
  return checks;
}
