import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PLAN_PATH = 'scripts/ci/test-plan.json';
const REGISTRY_PATH = 'scripts/ci/assertion-registry.json';
const GRAPH_PATH = 'scripts/ci/impact-dependency-graph.json';
const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
const base = process.env.CHANGE_BASE ?? 'origin/main';
const sha = process.env.EXPECTED_HEAD_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

function changedFiles() {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  return output.split('\n').map((value) => value.trim()).filter(Boolean);
}

function matchesPath(file, candidate) {
  if (candidate.endsWith('/')) return file.startsWith(candidate);
  if (candidate.endsWith('.')) return file.startsWith(candidate);
  return file === candidate;
}

const matchedSources = [];
const selectedAssertionSet = new Set();
let requiresBuild = false;
for (const source of graph.sources ?? []) {
  const matched = files.some((file) => (source.paths ?? []).some((candidate) => matchesPath(file, candidate)));
  if (!matched) continue;
  matchedSources.push(source.id);
  requiresBuild ||= Boolean(source.requiresBuild);
  for (const assertionId of source.assertions ?? []) selectedAssertionSet.add(assertionId);
}

const allStaticChecks = plan.gates?.static?.checks ?? [];
const allBuildChecks = plan.gates?.build?.checks ?? [];
const allStaticBuildAssertionIds = [
  ...allStaticChecks.flatMap((check) => check.assertions ?? []),
  ...allBuildChecks.flatMap((check) => check.assertions ?? []),
];

let files;
try {
  files = changedFiles();
} catch (error) {
  throw new Error(`Cannot resolve change base ${base}; refusing to guess impact. ${String(error?.message ?? error)}`, { cause: error });
}

const unmappedFiles = files.filter((file) => !matchedSources.some((sourceId) => {
  const source = (graph.sources ?? []).find((entry) => entry.id === sourceId);
  return source?.paths?.some((candidate) => matchesPath(file, candidate));
}));

const docsOnly = files.length > 0 && files.every((file) => /^(docs\/|README|CHANGELOG|LICENSE|\.github\/ISSUE_TEMPLATE\/)/i.test(file));
if (!docsOnly && unmappedFiles.length) {
  for (const assertionId of allStaticBuildAssertionIds) selectedAssertionSet.add(assertionId);
  requiresBuild = true;
}
if (docsOnly) {
  selectedAssertionSet.clear();
  selectedAssertionSet.add('ASSERT-CI-CONTRACT-001');
}

function addDependencyClosure(assertionIds) {
  const pending = [...assertionIds];
  const seen = new Set(assertionIds);
  while (pending.length) {
    const current = pending.pop();
    for (const dependency of registry.assertions[current]?.dependencies ?? []) {
      if (seen.has(dependency)) continue;
      seen.add(dependency);
      pending.push(dependency);
    }
  }
  return seen;
}

const selectedAssertions = [...addDependencyClosure(selectedAssertionSet)];
const ownerByAssertion = new Map(Object.entries(registry.assertions ?? {}).map(([id, entry]) => [id, entry.owner]));
const gateChecks = new Map([
  ...allStaticChecks.map((check) => [check.id, { ...check, gate: 'static' }]),
  ...allBuildChecks.map((check) => [check.id, { ...check, gate: 'build' }]),
  ...(plan.gates?.browser?.checks ?? []).map((check) => [check.id, { ...check, gate: 'browser' }]),
]);

for (const assertionId of selectedAssertions) {
  if (!registry.assertions[assertionId]) throw new Error(`Unknown assertion in impact graph: ${assertionId}`);
  const owner = ownerByAssertion.get(assertionId);
  if (!gateChecks.has(owner)) throw new Error(`Assertion ${assertionId} resolves to unknown owner ${owner}`);
}

const commands = [];
const reusedBrowserAssertions = [];
for (const assertionId of selectedAssertions) {
  const owner = ownerByAssertion.get(assertionId);
  const check = gateChecks.get(owner);
  if (check.gate === 'browser') {
    reusedBrowserAssertions.push({ assertionId, owner, certificationOwner: 'Matrix First Certification' });
    continue;
  }
  if (check.gate === 'build') requiresBuild = true;
  commands.push(check);
}

const dependencyEdges = selectedAssertions.flatMap((assertionId) => (registry.assertions[assertionId].dependencies ?? []).map((dependsOn) => ({ assertionId, dependsOn })));
const sourceEdges = matchedSources.flatMap((sourceId) => {
  const source = graph.sources.find((entry) => entry.id === sourceId);
  return (source?.assertions ?? []).map((assertionId) => ({ sourceId, assertionId, owner: ownerByAssertion.get(assertionId), gate: gateChecks.get(ownerByAssertion.get(assertionId))?.gate ?? 'unknown' }));
});

const uniqueCommands = [...new Map(commands.map((check) => [check.id, check])).values()];

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
const planOutput = {
  schema_version: 4,
  sha,
  base,
  mode: docsOnly ? 'FAST-MINIMAL' : unmappedFiles.length ? 'DEEP-UNMAPPED' : requiresBuild ? 'DEEP-GRAPH' : 'FAST-GRAPH',
  files,
  matchedSources,
  unmappedFiles,
  commands: uniqueCommands.map((check) => ({ id: check.id, gate: check.gate, assertions: check.assertions, coverage: check.coverage })),
  assertions: selectedAssertions,
  sourceEdges,
  dependencyEdges,
  reusedBrowserAssertions,
  graphAuthority: GRAPH_PATH,
  assertionRegistry: REGISTRY_PATH,
  browserCoverageOwner: 'Matrix First Certification',
  needBuild: requiresBuild,
};
writeFileSync('diagnostics/fast-ci-plan.json', `${JSON.stringify(planOutput, null, 2)}\n`);
console.log(JSON.stringify(planOutput, null, 2));

const executionResults = await Promise.all(uniqueCommands.map(runOne));
const summary = {
  schema_version: 4,
  sha,
  base,
  status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
  durationMs: Date.now() - start,
  executed: results,
  selectedAssertions,
  sourceEdges,
  dependencyEdges,
  reused: reusedBrowserAssertions,
  skipped: [],
  testPlanSha256: createHash('sha256').update(readFileSync(PLAN_PATH)).digest('hex'),
  assertionRegistrySha256: createHash('sha256').update(readFileSync(REGISTRY_PATH)).digest('hex'),
  impactGraphSha256: createHash('sha256').update(readFileSync(GRAPH_PATH)).digest('hex'),
};
writeFileSync('diagnostics/fast-ci-result.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (executionResults.some((value) => !value)) process.exit(1);
