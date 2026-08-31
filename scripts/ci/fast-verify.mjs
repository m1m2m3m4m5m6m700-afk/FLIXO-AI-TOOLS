import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.CHANGE_BASE ?? 'origin/main';
const sha = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

function changedFiles() {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  return output.split('\n').map((value) => value.trim()).filter(Boolean);
}

let files;
try {
  files = changedFiles();
} catch (error) {
  throw new Error(`Cannot resolve change base ${base}; refusing to guess impact. ${error instanceof Error ? error.message : String(error)}`);
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

const fastOnly = files.length > 0 && files.every((file) => /^(docs\/|README|CHANGELOG|LICENSE|\.github\/ISSUE_TEMPLATE\/)/i.test(file));
const fullImpact = flags.workflow || flags.dependency || flags.registry || flags.routing || flags.localization || flags.seo || flags.security || flags.artifact;
const mode = fastOnly ? 'FAST' : fullImpact ? 'TARGETED' : 'TARGETED';

const commands = [];
const add = (id, command, args, reason) => commands.push({ id, command, args, reason });

add('typecheck', 'npm', ['run', 'typecheck'], 'always');
add('lint', 'npm', ['run', 'lint'], 'always');
add('tool-registry', 'npm', ['run', 'validate:tool-registry'], 'always');
add('tool-manifest', 'npm', ['run', 'validate:tool-manifest'], 'always');
add('router-registry', 'npm', ['run', 'validate:router-registry'], 'always');
add('ci-contract', 'npm', ['run', 'validate:ci-contract'], 'always');

if (flags.registry) add('baseline', 'npm', ['run', 'validate:baseline'], 'registry impact');
if (flags.routing) add('route-resolver', 'npm', ['run', 'test:route-resolver'], 'routing impact');
if (flags.localization) {
  add('i18n-strict', 'npm', ['run', 'verify:i18n', '--', '--strict', '--report'], 'localization impact');
  add('locale-integrity', 'npm', ['run', 'validate:locale-integrity'], 'localization impact');
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
  add('affected-e2e', 'npx', ['playwright', 'test', ...toolTestCandidates, '--project=chromium', '--workers=2', '--retries=0'], 'changed tool surfaces');
}

const needBuild = flags.workflow || flags.dependency || flags.registry || flags.routing || flags.localization || flags.seo || flags.tools.length > 0;
const results = [];
const start = Date.now();

async function runOne(item) {
  const started = Date.now();
  try {
    const { stdout, stderr } = await exec(item.command, item.args, { env: process.env, maxBuffer: 4 * 1024 * 1024 });
    const durationMs = Date.now() - started;
    console.log(`PASS ${item.id} (${durationMs}ms)`);
    results.push({ id: item.id, status: 'PASS', durationMs, reason: item.reason });
    return true;
  } catch (error) {
    const durationMs = Date.now() - started;
    const stdout = error?.stdout ?? '';
    const stderr = error?.stderr ?? error?.message ?? String(error);
    console.error(`FAIL ${item.id} (${durationMs}ms)`);
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    results.push({ id: item.id, status: 'FAIL', durationMs, reason: item.reason });
    return false;
  }
}

mkdirSync('diagnostics', { recursive: true });
writeFileSync('diagnostics/fast-ci-plan.json', `${JSON.stringify({ schema_version: 1, sha, base, mode, files, flags, commands: commands.map(({ id, reason }) => ({ id, reason })), needBuild }, null, 2)}\n`);

console.log(JSON.stringify({ mode, sha, files, flags, commands: commands.map(({ id, reason }) => ({ id, reason })), needBuild }, null, 2));

const staticResults = await Promise.all(commands.map(runOne));
if (staticResults.some((value) => !value)) process.exit(1);

if (needBuild) {
  const buildItem = { id: 'build', command: 'npm', args: ['run', 'build'], reason: 'affected application graph' };
  const buildOk = await runOne(buildItem);
  if (!buildOk) process.exit(1);
}

const summary = {
  schema_version: 1,
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

if (summary.status !== 'PASS') process.exit(1);