import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.CHANGE_BASE ?? 'origin/main';
const sha = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const check = process.env.FAST_CI_CHECK ?? '';

const CHECKS = new Map([
  ['typecheck', { command: 'npm', args: ['run', 'typecheck'], impact: 'always' }],
  ['lint', { command: 'npm', args: ['run', 'lint'], impact: 'always' }],
  ['ci-contract', { command: 'npm', args: ['run', 'validate:ci-contract'], impact: 'always' }],
  ['tool-registry', { command: 'npm', args: ['run', 'validate:tool-registry'], impact: 'always' }],
  ['tool-manifest', { command: 'npm', args: ['run', 'validate:tool-manifest'], impact: 'always' }],
  ['router-registry', { command: 'npm', args: ['run', 'validate:router-registry'], impact: 'always' }],
  ['baseline', { command: 'npm', args: ['run', 'validate:baseline'], impact: 'registry' }],
  ['route-resolver', { command: 'npm', args: ['run', 'test:route-resolver'], impact: 'routing' }],
  ['i18n-strict', { command: 'npm', args: ['run', 'verify:i18n', '--', '--strict', '--report'], impact: 'localization' }],
  ['locale-integrity', { command: 'npm', args: ['run', 'validate:locale-integrity'], impact: 'localization' }],
  ['locale-navigation', { command: 'npm', args: ['run', 'validate:locale-navigation'], impact: 'localization' }],
  ['home-i18n', { command: 'npm', args: ['run', 'validate:home-i18n'], impact: 'localization' }],
  ['tool-localization', { command: 'npm', args: ['run', 'test:tool-localization'], impact: 'localization' }],
  ['browser-localization-smoke', { command: 'npx', args: ['playwright', 'test', 'tests/localization-browser-smoke.spec.ts', '--project=chromium', '--workers=1', '--retries=0', '--max-failures=1'], impact: 'localization', browser: true }],
  ['seo', { command: 'npm', args: ['run', 'validate:seo'], impact: 'seo' }],
  ['seo-manifest', { command: 'npm', args: ['run', 'validate:seo-manifest'], impact: 'seo' }],
  ['use-case-seo', { command: 'npm', args: ['run', 'validate:use-case-seo'], impact: 'seo' }],
  ['indexing', { command: 'npm', args: ['run', 'validate:indexing'], impact: 'seo' }],
  ['breadcrumb-seo', { command: 'npm', args: ['run', 'validate:breadcrumb-seo'], impact: 'seo' }],
  ['multilingual-seo', { command: 'node', args: ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-google-multilingual-seo.mjs'], impact: 'seo' }],
  ['language-quality-strict', { command: 'node', args: ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-language-quality-strict.mjs'], impact: 'localization' }],
  ['upload-boundary', { command: 'npm', args: ['run', 'test:upload-boundary'], impact: 'security' }],
  ['file-safety', { command: 'node', args: ['--experimental-strip-types', 'scripts/test-file-safety.mjs'], impact: 'artifact' }],
  ['output-integrity', { command: 'node', args: ['--experimental-strip-types', 'scripts/test-output-integrity.mjs'], impact: 'artifact' }],
  ['svg-integrity', { command: 'node', args: ['--experimental-strip-types', 'scripts/test-svg-integrity.mjs'], impact: 'artifact' }],
  ['affected-e2e', { impact: 'tools', browser: true }],
  ['build', { command: 'npm', args: ['run', 'build'], impact: 'build' }],
]);

if (check && !CHECKS.has(check)) throw new Error(`Unknown FAST_CI_CHECK: ${check}`);

function changedFiles() {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  return output.split('\n').map((value) => value.trim()).filter(Boolean);
}

let files;
try {
  files = changedFiles();
} catch (error) {
  const cause = error instanceof Error ? error : new Error(String(error));
  throw new Error(`Cannot resolve change base ${base}; refusing to guess impact. ${cause.message}`, { cause: error });
}

const flags = {
  workflow: files.some((file) => file.startsWith('.github/workflows/')),
  dependency: files.some((file) => /^(package\.json|package-lock\.json|npm-shrinkwrap\.json|\.nvmrc|vite\.config\.|playwright\.config\.|tsconfig(?:\.|$))/.test(file)),
  registry: files.some((file) => /^(src\/config\/tools|src\/config\/tool-definitions|src\/config\/tool-manifest|scripts\/validate-tool-(registry|manifest)|scripts\/ci\/validate-architecture)/.test(file)),
  routing: files.some((file) => /^(src\/lib\/routing|src\/routes\/|scripts\/validate-router-registry)/.test(file)),
  localization: files.some((file) => /^(index\.html|src\/main\.tsx|src\/.*(?:i18n|locale|localization)|tests\/localization|scripts\/validate-(locale|language|localization)|scripts\/test-(i18n|tool-localization))/.test(file)),
  seo: files.some((file) => /^(src\/.*seo|scripts\/(validate|generate)-(seo|robots|sitemap)|public\/(robots|sitemap))/.test(file)),
  security: files.some((file) => /^(src\/.*(?:security|upload|file-safety)|scripts\/.*(?:security|file-safety)|\.gitleaks\.toml)/.test(file)) || files.includes('package-lock.json'),
  artifact: files.some((file) => /^(src\/lib\/contracts|scripts\/.*(?:artifact|output-integrity)|tests\/.*(?:artifact|output-integrity|svg-integrity))/.test(file)),
  tools: [...new Set(files.map((file) => file.match(/^src\/tools\/([^/]+)/)?.[1]).filter(Boolean))],
};

const impactMatched = (impact) => {
  if (impact === 'always') return true;
  if (impact === 'registry') return flags.registry;
  if (impact === 'routing') return flags.routing;
  if (impact === 'localization') return flags.localization;
  if (impact === 'seo') return flags.seo;
  if (impact === 'security') return flags.security;
  if (impact === 'artifact') return flags.artifact;
  if (impact === 'build') return flags.workflow || flags.dependency || flags.registry || flags.routing || flags.localization || flags.seo;
  if (impact === 'tools') return flags.tools.length > 0;
  return false;
};

const toolTestCandidates = flags.tools.map((tool) => `tests/${tool}.spec.ts`).filter((path) => existsSync(path));
const runBrowserSmoke = check === 'browser-localization-smoke';
const runAffectedE2E = check === 'affected-e2e' && toolTestCandidates.length > 0;
const plan = {
  schema_version: 3,
  sha,
  base,
  check: check || 'all',
  files,
  flags,
  impact_matched: check ? impactMatched(CHECKS.get(check).impact) : true,
  tool_tests: toolTestCandidates,
  runBrowserSmoke,
  runAffectedE2E,
};

mkdirSync('diagnostics', { recursive: true });
writeFileSync('diagnostics/fast-ci-plan.json', `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));

const start = Date.now();
const results = [];

async function runOne(item) {
  const started = Date.now();
  try {
    await exec(item.command, item.args, { env: process.env, maxBuffer: 4 * 1024 * 1024 });
    const durationMs = Date.now() - started;
    console.log(`PASS ${item.id} (${durationMs}ms)`);
    results.push({ id: item.id, status: 'PASS', durationMs });
    return true;
  } catch (error) {
    const durationMs = Date.now() - started;
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${item.id} (${durationMs}ms)`);
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    results.push({ id: item.id, status: 'FAIL', durationMs, error: stderr.slice(-12000) });
    return false;
  }
}

async function runCheck(id) {
  const definition = CHECKS.get(id);
  if (!definition) throw new Error(`Unknown FAST_CI_CHECK: ${id}`);

  if (!impactMatched(definition.impact)) {
    console.log(`SKIP ${id} (no impact)`);
    results.push({ id, status: 'SKIPPED', durationMs: 0, reason: 'no dependency impact' });
    return true;
  }

  if (id === 'affected-e2e' && !runAffectedE2E) {
    console.log(`SKIP ${id} (no changed tool test candidates)`);
    results.push({ id, status: 'SKIPPED', durationMs: 0, reason: 'no changed tool test candidates' });
    return true;
  }

  if (id === 'affected-e2e') {
    const install = await runOne({ id: 'playwright-install', command: 'npx', args: ['playwright', 'install', 'chromium'] });
    if (!install) return false;
    return runOne({ id, command: 'npx', args: ['playwright', 'test', ...toolTestCandidates, '--project=chromium', '--workers=2', '--retries=0'] });
  }

  if (definition.browser && (runBrowserSmoke || id === 'browser-localization-smoke')) {
    const install = await runOne({ id: 'playwright-install', command: 'npx', args: ['playwright', 'install', 'chromium'] });
    if (!install) return false;
  }

  return runOne({ id, command: definition.command, args: definition.args });
}

if (check) {
  await runCheck(check);
} else {
  for (const id of CHECKS.keys()) {
    const ok = await runCheck(id);
    if (!ok) break;
  }
}

const status = results.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS';
const summary = {
  schema_version: 3,
  sha,
  base,
  check: check || 'all',
  status,
  durationMs: Date.now() - start,
  executed: results,
  skipped: results.filter((item) => item.status === 'SKIPPED'),
};
writeFileSync('diagnostics/fast-ci-result.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (status !== 'PASS') process.exit(1);