import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.CHANGE_BASE ?? 'origin/main';
const sha = process.env.EXPECTED_HEAD_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

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
  localization: files.some((file) => /^(src\/.*(?:i18n|locale|localization)|tests\/localization|scripts\/validate-(locale|language|localization)|scripts\/test-(i18n|tool-localization))/.test(file)),
  seo: files.some((file) => /^(src\/.*seo|scripts\/(validate|generate)-(seo|robots|sitemap)|public\/(robots|sitemap))/.test(file)),
  security: files.some((file) => /^(src\/.*(?:security|upload|file-safety)|scripts\/.*(?:security|file-safety)|\.gitleaks\.toml)/.test(file)) || files.includes('package-lock.json'),
  artifact: files.some((file) => /^(src\/lib\/contracts|scripts\/.*(?:artifact|output-integrity)|tests\/.*(?:artifact|output-integrity|svg-integrity))/.test(file)),
  tools: [...new Set(files.map((file) => file.match(/^src\/tools\/([^/]+)/)?.[1]).filter(Boolean))],
};

const sourceFiles = files.filter((file) => existsSync(file) && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const typedSourceFiles = files.filter((file) => /\.(?:ts|tsx)$/.test(file));
const testFiles = files.filter((file) => /^(?:tests|test)\/.*\.(?:ts|tsx|js|mjs|cjs)$/.test(file));
const docsOnly = files.length > 0 && files.every((file) => /^(docs\/|README|CHANGELOG|LICENSE|\.github\/ISSUE_TEMPLATE\/)/i.test(file));

const commands = [];
const add = (id, command, args, reason) => commands.push({ id, command, args, reason });

// Minimal invariant for every PR/main execution.
add('ci-contract', 'npm', ['run', 'validate:ci-contract'], 'CI contract invariant');

if (typedSourceFiles.length > 0 || flags.dependency) {
  add('typecheck', 'npm', ['run', 'typecheck'], 'typed/dependency impact');
}
if (sourceFiles.length > 0) {
  add('lint-changed', 'npx', ['eslint', '--no-warn-ignored', ...sourceFiles], 'changed files only');
}
if (flags.registry) {
  add('tool-registry', 'npm', ['run', 'validate:tool-registry'], 'registry impact');
  add('tool-manifest', 'npm', ['run', 'validate:tool-manifest'], 'registry manifest impact');
  add('baseline', 'npm', ['run', 'validate:baseline'], 'registry impact');
}
if (flags.routing) {
  add('router-registry', 'npm', ['run', 'validate:router-registry'], 'routing impact');
  add('route-resolver', 'npm', ['run', 'test:route-resolver'], 'routing impact');
}
if (flags.localization) {
  add('i18n-strict', 'npm', ['run', 'verify:i18n', '--', '--strict', '--report'], 'localization impact');
  add('locale-navigation', 'npm', ['run', 'validate:locale-navigation'], 'localization impact');
  add('home-i18n', 'npm', ['run', 'validate:home-i18n'], 'localization impact');
  add('tool-localization', 'npm', ['run', 'test:tool-localization'], 'localization impact');
}
if (flags.seo) {
  add('seo', 'npm', ['run', 'validate:seo'], 'SEO impact');
  add('seo-manifest', 'npm', ['run', 'validate:seo-manifest'], 'SEO impact');
  add('use-case-seo', 'npm', ['run', 'validate:use-case-seo'], 'SEO impact');
  add('indexing', 'npm', ['run', 'validate:indexing'], 'SEO/indexing impact');
  add('breadcrumb-seo', 'npm', ['run', 'validate:breadcrumb-seo'], 'SEO impact');
}
if (flags.security) add('upload-boundary', 'npm', ['run', 'test:upload-boundary'], 'security/upload impact');
if (flags.artifact) {
  add('file-safety', 'node', ['--experimental-strip-types', 'scripts/test-file-safety.mjs'], 'artifact/file safety impact');
  add('output-integrity', 'node', ['--experimental-strip-types', 'scripts/test-output-integrity.mjs'], 'artifact impact');
  add('svg-integrity', 'node', ['--experimental-strip-types', 'scripts/test-svg-integrity.mjs'], 'artifact impact');
}

const toolTestCandidates = [];
for (const tool of flags.tools) {
  const candidate = `tests/${tool}.spec.ts`;
  if (existsSync(candidate)) toolTestCandidates.push(candidate);
}
if (toolTestCandidates.length) {
  add('playwright-install', 'npx', ['playwright', 'install', 'chromium'], 'affected browser checks');
  add('affected-e2e', 'npx', ['playwright', 'test', ...toolTestCandidates, '--project=chromium', '--workers=2', '--retries=0'], 'changed tool surfaces');
}

const needBuild = flags.workflow || flags.dependency || flags.registry || flags.routing || flags.localization || flags.seo;
const sensitiveChange = flags.workflow || flags.dependency || files.some((file) => file.startsWith('src/lib/contracts/'));
if (needBuild) add('build', 'npm', ['run', 'build'], 'affected application/build graph');
if (testFiles.length === 1 && !sensitiveChange && !sourceFiles.includes(testFiles[0])) {
  add('changed-test', 'node', ['--experimental-strip-types', testFiles[0]], 'single changed test');
}
if (docsOnly) {
  commands.splice(0, commands.length);
  add('ci-contract', 'npm', ['run', 'validate:ci-contract'], 'CI contract invariant');
}

const mode = sensitiveChange ? 'DEEP-ESCALATED' : docsOnly ? 'FAST-MINIMAL' : 'FAST-TARGETED';
const results = [];
const start = Date.now();
async function runOne(item) {
  const started = Date.now();
  try {
    await exec(item.command, item.args, { env: process.env, maxBuffer: 4 * 1024 * 1024 });
    const durationMs = Date.now() - started;
    console.log(`PASS ${item.id} (${durationMs}ms)`);
    results.push({ id: item.id, status: 'PASS', durationMs, reason: item.reason });
    return true;
  } catch (error) {
    const durationMs = Date.now() - started;
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${item.id} (${durationMs}ms)`);
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    results.push({ id: item.id, status: 'FAIL', durationMs, reason: item.reason, stderr });
    return false;
  }
}

mkdirSync('diagnostics', { recursive: true });
const plan = {
  schema_version: 2,
  sha,
  base,
  mode,
  files,
  flags,
  sourceFiles,
  typedSourceFiles,
  testFiles,
  commands: commands.map(({ id, reason }) => ({ id, reason })),
  needBuild,
  sensitiveChange,
};
writeFileSync('diagnostics/fast-ci-plan.json', `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));

const playwrightInstall = commands.find((item) => item.id === 'playwright-install');
const affectedE2e = commands.find((item) => item.id === 'affected-e2e');
const independentCommands = commands.filter((item) => item.id !== 'affected-e2e' && item.id !== 'playwright-install');
const independentResults = await Promise.all(independentCommands.map(runOne));
let playwrightReady = true;
if (playwrightInstall) playwrightReady = await runOne(playwrightInstall);
if (affectedE2e) {
  if (playwrightReady) await runOne(affectedE2e);
  else {
    console.error('BLOCK affected-e2e: Playwright installation failed; browser tests were not started.');
    results.push({ id: 'affected-e2e', status: 'BLOCKED', durationMs: 0, reason: 'Playwright prerequisite failed' });
  }
}

const summary = {
  schema_version: 2,
  sha,
  base,
  mode,
  status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
  durationMs: Date.now() - start,
  executed: results,
  reused: [],
  skipped: [],
};
writeFileSync('diagnostics/fast-ci-result.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (independentResults.some((value) => !value) || !results.every((item) => item.status === 'PASS')) process.exit(1);
