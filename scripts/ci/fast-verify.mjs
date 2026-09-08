import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PLAN_PATH = 'scripts/ci/test-plan.json';
const REGISTRY_PATH = 'scripts/ci/assertion-registry.json';
const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
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
  throw new Error(`Cannot resolve change base ${base}; refusing to guess impact. ${String(error?.message ?? error)}`);
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
};

const docsOnly = files.length > 0 && files.every((file) => /^(docs\/|README|CHANGELOG|LICENSE|\.github\/ISSUE_TEMPLATE\/)/i.test(file));
const impactChecks = new Set(['STATIC-011']);
const addIds = (...ids) => ids.forEach((id) => impactChecks.add(id));

if (flags.dependency) addIds('STATIC-001','STATIC-002','STATIC-013','STATIC-025');
if (flags.registry) addIds('STATIC-005','STATIC-006','STATIC-007');
if (flags.routing) addIds('STATIC-008');
if (flags.localization) addIds('STATIC-004','STATIC-009','STATIC-018','STATIC-019','STATIC-020','STATIC-022');
if (flags.seo) addIds('STATIC-010','STATIC-021','STATIC-023','STATIC-024');
if (flags.security) addIds('STATIC-014','STATIC-003');
if (flags.artifact) addIds('STATIC-015','STATIC-016');
if (flags.workflow) addIds('STATIC-011','STATIC-026');

const needBuild = flags.workflow || flags.dependency || flags.registry || flags.routing || flags.localization || flags.seo || flags.security || flags.artifact;
if (needBuild) addIds('BUILD-001','BUILD-003');
if (docsOnly) {
  impactChecks.clear();
  addIds('STATIC-011');
}

function checkById(id) {
  for (const gate of ['static', 'build', 'browser']) {
    const check = (plan.gates?.[gate]?.checks ?? []).find((entry) => entry.id === id);
    if (check) return { ...check, gate };
  }
  throw new Error(`Unknown canonical check: ${id}`);
}

const commands = [...impactChecks].map((id) => checkById(id));
const registryKeys = new Set(Object.keys(registry.assertions ?? {}));
for (const check of commands) {
  for (const assertionId of check.assertions ?? []) {
    if (!registryKeys.has(assertionId)) throw new Error(`Canonical assertion missing from registry: ${assertionId}`);
    if (registry.assertions[assertionId].owner !== check.id) throw new Error(`Assertion ownership drift: ${assertionId}`);
  }
}

const results = [];
const start = Date.now();
async function runOne(check) {
  const started = Date.now();
  try {
    await exec(check.command, check.args ?? [], { env: process.env, maxBuffer: 4 * 1024 * 1024 });
    const durationMs = Date.now() - started;
    results.push({ id: check.id, gate: check.gate, status: 'PASS', durationMs, reason: 'canonical test-plan assertion owner' });
    return true;
  } catch (error) {
    const durationMs = Date.now() - started;
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : String(error?.message ?? error);
    const output = `${stdout}\n${stderr}`;
    const rootCauseId = /TS\d+|not assignable|cannot find name/i.test(output)
      ? 'RC-TYPE-001'
      : /npm ci|lockfile|package-lock|ERESOLVE/i.test(output)
        ? 'RC-DEPENDENCY-001'
        : /canonical|hreflang|sitemap|seo/i.test(output)
          ? 'RC-SEO-001'
          : /locale|translation|language|localized/i.test(output)
            ? 'RC-I18N-001'
            : /build failed|vite.*error|rollup|esbuild/i.test(output)
              ? 'RC-BUILD-001'
              : check.gate === 'browser' ? 'RC-BROWSER-001' : 'RC-UNKNOWN-001';
    results.push({ id: check.id, gate: check.gate, status: 'FAIL', durationMs, reason: 'canonical test-plan assertion owner', rootCauseId, stderr });
    return false;
  }
}

mkdirSync('diagnostics', { recursive: true });
const selectedAssertions = [...new Set(commands.flatMap((check) => check.assertions ?? []))];
const dependencyEdges = selectedAssertions.flatMap((assertionId) => {
  const entry = registry.assertions[assertionId];
  return (entry.dependencies ?? []).map((dependsOn) => ({ assertionId, dependsOn }));
});
const planOutput = {
  schema_version: 3,
  sha,
  base,
  mode: docsOnly ? 'FAST-MINIMAL' : needBuild ? 'DEEP-ESCALATED' : 'FAST-TARGETED',
  files,
  flags,
  commands: commands.map((check) => ({ id: check.id, gate: check.gate, assertions: check.assertions, coverage: check.coverage })),
  assertions: selectedAssertions,
  dependencyEdges,
  browserCoverageOwner: 'Matrix First Certification',
  needBuild,
};
writeFileSync('diagnostics/fast-ci-plan.json', `${JSON.stringify(planOutput, null, 2)}\n`);
console.log(JSON.stringify(planOutput, null, 2));

const independentResults = await Promise.all(commands.map(runOne));
const summary = {
  schema_version: 3,
  sha,
  base,
  status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
  durationMs: Date.now() - start,
  executed: results,
  selectedAssertions,
  dependencyEdges,
  reused: flags.workflow || flags.registry || flags.routing || flags.localization || flags.seo || flags.artifact
    ? [{ owner: 'Matrix First Certification', policy: 'browser assertions are never rerun by Fast CI' }]
    : [],
  skipped: [],
  testPlanSha256: createHash('sha256').update(readFileSync(PLAN_PATH)).digest('hex'),
};
writeFileSync('diagnostics/fast-ci-result.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (independentResults.some((value) => !value)) process.exit(1);
