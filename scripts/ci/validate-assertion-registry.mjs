import fs from 'node:fs';
import path from 'node:path';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const plan = JSON.parse(read('scripts/ci/test-plan.json'));
const registry = JSON.parse(read('scripts/ci/assertion-registry.json'));
const packageJson = JSON.parse(read('package.json'));
const planAssertions = new Map(Object.entries(plan.assertions ?? {}));
const registryAssertions = new Map(Object.entries(registry.assertions ?? {}));
const errors = [];
const ownerToAssertion = new Map();
const referenced = new Map();
const executionOwners = new Map();

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else out.push(absolute.replaceAll(path.sep, '/'));
    }
  };
  walk(dir);
  return out;
};

const allSpecFiles = listFiles('tests').filter((file) => /\.spec\.(?:ts|js|mjs)$/.test(file));
const normalizeSource = (file) => file?.replace(/^\.\//, '').replaceAll('\\', '/');
const unique = (values) => [...new Set(values)];

const collectLocalSources = (command, args = []) => {
  const candidates = [];
  const tokens = [command, ...args].filter((v) => typeof v === 'string');
  for (const token of tokens) {
    const clean = token.split(/[?#]/, 1)[0];
    if (/^(?:tests|scripts)\/.+\.(?:mjs|js|ts)$/.test(clean)) candidates.push(normalizeSource(clean));
    if (/^(?:tests|scripts)\/.+\/$/.test(clean)) candidates.push(normalizeSource(clean));
  }
  return unique(candidates);
};

const resolveNpmScriptSources = (scriptName, seen = new Set()) => {
  if (!scriptName || seen.has(scriptName)) return [];
  seen.add(scriptName);
  const script = packageJson.scripts?.[scriptName];
  if (typeof script !== 'string') return [];
  const sources = collectLocalSources('npm', script.split(/\s+/));
  for (const nested of script.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    sources.push(...resolveNpmScriptSources(nested[1], seen));
  }
  return unique(sources);
};

const executableEvidence = (source, kind) => {
  if (!source || !fs.existsSync(source)) return false;
  const text = read(source);
  if (kind === 'browser') return /\b(?:test|test\.describe|it)\s*\(/.test(text) && /\b(?:expect|assert|toBe|toEqual|toHave|toContain|toBeVisible|toHaveCount)\b/.test(text);
  if (/\.spec\.(?:ts|js|mjs)$/.test(source)) return /\b(?:test|it)\s*\(/.test(text) && /\b(?:expect|assert)\b/.test(text);
  return /\b(?:assert|expect|throw new Error|process\.exit\s*\(|!==|===|>=|<=)\b/.test(text);
};

const importedHelpers = (source) => {
  if (!fs.existsSync(source) || !/\.spec\.(?:ts|js|mjs)$/.test(source)) return [];
  const text = read(source);
  const helpers = [];
  for (const match of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.\.?\/[^'"]+)['"]/g)) {
    const names = match[1].split(',').map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const importedPath = path.normalize(path.join(path.dirname(source), match[2])).replaceAll(path.sep, '/');
    const candidatePaths = [
      importedPath,
      `${importedPath}.ts`,
      `${importedPath}.js`,
      `${importedPath}.mjs`,
      `${importedPath}/index.ts`,
      `${importedPath}/index.js`,
    ];
    const helperSource = candidatePaths.find((candidate) => fs.existsSync(candidate));
    for (const name of names) helpers.push({ name, spec: normalizeSource(source), source: helperSource ? normalizeSource(helperSource) : null, used: (text.match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) ?? []).length > 1 });
  }
  return helpers;
};

for (const [assertionId, entry] of registryAssertions) {
  if (!entry || typeof entry !== 'object') { errors.push(`${assertionId}: invalid registry entry`); continue; }
  if (!entry.owner || !entry.contract || !Array.isArray(entry.coverage) || !Array.isArray(entry.dependencies) || !entry.runtime_scope || !entry.rootCauseClass) errors.push(`${assertionId}: incomplete canonical metadata`);
  const prior = ownerToAssertion.get(entry.owner);
  if (prior && prior !== assertionId) errors.push(`OWNER_COLLISION: ${entry.owner} owns ${prior} and ${assertionId}`);
  ownerToAssertion.set(entry.owner, assertionId);
  for (const dependency of entry.dependencies) if (!registryAssertions.has(dependency)) errors.push(`${assertionId}: unknown dependency ${dependency}`);
}

const state = new Map([...registryAssertions.keys()].map((id) => [id, 0]));
const visit = (id, stack = []) => {
  if (state.get(id) === 1) { const start = stack.indexOf(id); errors.push(`DEPENDENCY_CYCLE: ${[...stack.slice(start), id].join(' -> ')}`); return; }
  if (state.get(id) === 2) return;
  state.set(id, 1);
  for (const dep of registryAssertions.get(id)?.dependencies ?? []) if (registryAssertions.has(dep)) visit(dep, [...stack, id]);
  state.set(id, 2);
};
for (const id of registryAssertions.keys()) visit(id);

for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    const assertions = check.assertions ?? [];
    if (assertions.length !== 1) errors.push(`${gate}/${check.id}: expected exactly one assertion owner, found ${assertions.length}`);
    for (const assertionId of assertions) {
      if (!registryAssertions.has(assertionId)) errors.push(`${gate}/${check.id}: assertion ${assertionId} missing from canonical registry`);
      const refs = referenced.get(assertionId) ?? [];
      refs.push(check.id); referenced.set(assertionId, refs);
      const entry = registryAssertions.get(assertionId);
      if (entry && entry.owner !== check.id) errors.push(`${assertionId}: registry owner ${entry.owner} != plan owner ${check.id}`);
      if (entry && JSON.stringify([...entry.coverage].sort()) !== JSON.stringify([...(check.coverage ?? [])].sort())) errors.push(`${assertionId}: coverage mismatch`);
    }
    executionOwners.set(check.id, check);
    if (check.command === 'npm' && check.args?.[0] === 'run' && !Object.hasOwn(packageJson.scripts ?? {}, check.args?.[1])) errors.push(`${gate}/${check.id}: missing npm script ${check.args?.[1] ?? '<missing>'}`);
    if (check.command === 'node') {
      const fileArg = [...(check.args ?? [])].reverse().find((arg) => typeof arg === 'string' && !arg.startsWith('-') && /\.(?:mjs|js|ts)$/.test(arg));
      if (fileArg && !fs.existsSync(path.resolve(fileArg))) errors.push(`${gate}/${check.id}: missing executable ${fileArg}`);
    }
  }
}

for (const assertionId of planAssertions.keys()) if (!registryAssertions.has(assertionId)) errors.push(`${assertionId}: declared in test-plan but missing from registry`);
for (const assertionId of registryAssertions.keys()) if ((referenced.get(assertionId) ?? []).length !== 1) errors.push(`${assertionId}: expected one execution owner reference`);

const implementations = [];
for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    const assertionId = check.assertions?.[0];
    if (!assertionId) continue;
    let sources = collectLocalSources(check.command, check.args ?? []);
    if (check.command === 'npm' && check.args?.[0] === 'run') sources = unique([...sources, ...resolveNpmScriptSources(check.args[1])]);
    const browser = gate === 'browser' || check.command === 'npx' && (check.args ?? []).includes('playwright');
    if (browser) sources = unique([...sources, ...(check.args ?? []).filter((arg) => typeof arg === 'string' && /^tests\/.+\.spec\.(?:ts|js|mjs)$/.test(arg)).map(normalizeSource)]);
    const existingSources = sources.filter((source) => fs.existsSync(source));
    const sourceWithAssertionConstruct = existingSources.find((source) => executableEvidence(source, browser ? 'browser' : 'node')) ?? null;
    if (!sourceWithAssertionConstruct) errors.push(`${assertionId}: no executable implementation source attributable to owner ${check.id}`);
    if (browser && existingSources.length === 0) errors.push(`${assertionId}: browser owner has no discoverable spec file`);
    const helpers = unique(existingSources.flatMap(importedHelpers).map((helper) => JSON.stringify(helper))).map((item) => JSON.parse(item));
    for (const helper of helpers) {
      if (!helper.source) errors.push(`${assertionId}: helper ${helper.name} imported by ${helper.spec} cannot be resolved`);
      else if (!helper.used) errors.push(`${assertionId}: helper ${helper.name} imported by ${helper.spec} is not actually referenced`);
    }
    implementations.push({ assertionId, owner: check.id, gate, command: [check.command, ...(check.args ?? [])].join(' '), sources: existingSources, executableSource: sourceWithAssertionConstruct, helpers });
  }
}

const referencedBrowserSpecs = new Set(implementations.filter((item) => item.gate === 'browser').flatMap((item) => item.sources.filter((source) => /\.spec\.(?:ts|js|mjs)$/.test(source))));
const fastWorkflowSpecs = new Set();
const ci = read('.github/workflows/ci.yml');
for (const spec of ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []) fastWorkflowSpecs.add(normalizeSource(spec));
for (const spec of fastWorkflowSpecs) {
  if (!allSpecFiles.includes(spec)) errors.push(`BROWSER_SPEC_MISSING: workflow references ${spec} but file does not exist`);
  if (!referencedBrowserSpecs.has(spec)) errors.push(`BROWSER_SPEC_UNOWNED: ${spec} is executable browser surface but no canonical browser assertion owner references it`);
}
const unreferencedAuthoritativeSpecs = allSpecFiles.filter((spec) => /universal-runtime-evidence|universal-diagnostic-browser/.test(spec) && !referencedBrowserSpecs.has(spec));
for (const spec of unreferencedAuthoritativeSpecs) errors.push(`SPEC_ASSERTION_ORPHAN: authoritative runtime spec ${spec} is not owned by any canonical browser assertion`);

const executableSignatures = new Map();
for (const [owner, check] of executionOwners) {
  const signature = JSON.stringify([check.command, ...(check.args ?? [])]);
  const prior = executableSignatures.get(signature);
  if (prior && prior !== owner) errors.push(`EXECUTION_DUPLICATE: ${prior} and ${owner}`);
  executableSignatures.set(signature, owner);
}

const architectureChecks = [
  ['single canonical workflow', /name:\s*FLIXO Test System/.test(ci)],
  ['single static+build engine', /\n\s{2}verify:\s*\n/.test(ci)],
  ['FAST browser engine', /\n\s{2}browser_fast:\s*\n/.test(ci)],
  ['DEEP browser engine', /\n\s{2}browser_deep:\s*\n/.test(ci)],
  ['single certify gate', /\n\s{2}certify:\s*\n/.test(ci)],
  ['three browsers', /browser:\s*\[chromium, firefox, webkit\]/.test(ci)],
  ['22 FAST tool specs', new Set((ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).filter((spec) => !/universal-diagnostic-browser|localization-runtime/.test(spec))).size === 22],
  ['DEEP localization runtime', /tests\/localization-runtime\.spec\.ts/.test(ci)],
  ['immutable artifact', /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci)],
];
for (const [label, pass] of architectureChecks) if (!pass) errors.push(`ARCHITECTURE: ${label}`);

const sourceAssertions = implementations.filter((item) => item.executableSource).map((item) => item.assertionId);
for (const assertionId of registryAssertions.keys()) if (!sourceAssertions.includes(assertionId)) errors.push(`${assertionId}: registry-only assertion has no executable implementation mapping`);

const result = {
  schema_version: 6,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  executionOwnerCount: executionOwners.size,
  implementationCount: implementations.length,
  executableImplementationCount: sourceAssertions.length,
  browserSpecCount: allSpecFiles.length,
  referencedBrowserSpecCount: referencedBrowserSpecs.size,
  architecture: { engines: ['static+build', 'browser-fast', 'browser-deep', 'certify'], browserFast: { tools: 22, browsers: 3, units: 66 }, browserDeep: { locales: 20, browsers: 3 } },
  architectureChecks: architectureChecks.map(([label, pass]) => ({ label, status: pass ? 'PASS' : 'FAIL' })),
  implementations,
  errors,
};
fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
