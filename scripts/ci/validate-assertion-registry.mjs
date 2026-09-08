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

const normalize = (file) => String(file).replaceAll(path.sep, '/').replace(/^\.\//, '');
const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else out.push(normalize(absolute));
    }
  };
  walk(dir);
  return out;
};
const allSpecFiles = listFiles('tests').filter((file) => /\.spec\.(?:ts|js|mjs)$/.test(file));
const unique = (values) => [...new Set(values)];
const fileArgument = (args = []) => [...args].reverse().find((arg) => typeof arg === 'string' && /^(?:tests|scripts)\/.+\.(?:mjs|js|ts)$/.test(arg));
const npmScriptExists = (name) => typeof packageJson.scripts?.[name] === 'string';

const localSourcesFromScript = (scriptName, seen = new Set()) => {
  if (!scriptName || seen.has(scriptName)) return [];
  seen.add(scriptName);
  const script = packageJson.scripts?.[scriptName];
  if (typeof script !== 'string') return [];
  const sources = [];
  for (const token of script.split(/\s+/)) {
    const clean = token.split(/[?#]/, 1)[0];
    if (/^(?:tests|scripts)\/.+\.(?:mjs|js|ts)$/.test(clean)) sources.push(normalize(clean));
  }
  for (const nested of script.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)) sources.push(...localSourcesFromScript(nested[1], seen));
  return unique(sources);
};

const sourceText = (source) => fs.existsSync(source) ? read(source) : '';
const hasExecutableAssertion = (source) => /\b(?:assert|expect|throw new Error|process\.exit\s*\(|strictEqual|deepStrictEqual)\b/.test(source);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exactTestBody = (source, testTitle) => {
  const titlePattern = new RegExp(`(?:test|it)\\s*\\(\\s*(['"])${escapeRegExp(testTitle)}\\1\\s*,\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{`, 'm');
  const match = titlePattern.exec(source);
  if (!match) return null;
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = match.index + match[0].length; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  return null;
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
    if (check.command === 'npm' && check.args?.[0] === 'run' && !npmScriptExists(check.args?.[1])) errors.push(`${gate}/${check.id}: missing npm script ${check.args?.[1] ?? '<missing>'}`);
    if (check.command === 'node') {
      const file = fileArgument(check.args);
      if (file && !fs.existsSync(path.resolve(file))) errors.push(`${gate}/${check.id}: missing executable ${file}`);
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
    const entry = registryAssertions.get(assertionId);
    const browser = gate === 'browser' || (check.command === 'npx' && (check.args ?? []).includes('playwright'));
    let implementation;
    if (browser) {
      implementation = entry?.implementation;
      if (!implementation || implementation.kind !== 'playwright-test' || !implementation.spec || !implementation.test) {
        errors.push(`${assertionId}: browser assertion requires canonical playwright implementation {spec,test}`);
      } else {
        const spec = normalize(implementation.spec);
        if (!fs.existsSync(spec)) errors.push(`${assertionId}: implementation spec missing ${spec}`);
        else {
          const text = sourceText(spec);
          const exactBody = exactTestBody(text, implementation.test);
          if (!exactBody) errors.push(`${assertionId}: exact implementation test body not found in ${spec}`);
          else if (!hasExecutableAssertion(exactBody)) errors.push(`${assertionId}: exact implementation test body contains no executable assertion construct`);
        }
      }
    } else {
      const file = fileArgument(check.args);
      const scriptName = check.command === 'npm' && check.args?.[0] === 'run' ? check.args[1] : null;
      const sources = unique([
        file ? normalize(file) : null,
        ...(scriptName ? localSourcesFromScript(scriptName) : []),
      ].filter(Boolean));
      const missing = sources.filter((source) => !fs.existsSync(source));
      if (missing.length) errors.push(`${assertionId}: implementation source missing ${missing.join(', ')}`);
      implementation = {
        kind: sources.length ? 'executable-source' : 'tooling-command',
        command: [check.command, ...(check.args ?? [])],
        sources,
        sourceExists: sources.every((source) => fs.existsSync(source)),
      };
    }
    implementations.push({ assertionId, owner: check.id, gate, implementation });
  }
}

const markerRefs = [];
for (const spec of allSpecFiles) {
  const text = sourceText(spec);
  for (const match of text.matchAll(/@flixo-canonical-assertion\s+([A-Z0-9-]+)/g)) markerRefs.push({ spec, assertionId: match[1] });
}
for (const marker of markerRefs) {
  if (!registryAssertions.has(marker.assertionId)) errors.push(`SPEC_ASSERTION_UNREGISTERED: ${marker.spec} references ${marker.assertionId}, absent from registry`);
  else {
    const implementation = registryAssertions.get(marker.assertionId)?.implementation;
    if (implementation?.spec && normalize(implementation.spec) !== marker.spec) errors.push(`SPEC_ASSERTION_WRONG_OWNER: ${marker.spec} references ${marker.assertionId}, canonical spec is ${normalize(implementation.spec)}`);
  }
}

const executableSignatures = new Map();
for (const [owner, check] of executionOwners) {
  const signature = JSON.stringify([check.command, ...(check.args ?? [])]);
  const prior = executableSignatures.get(signature);
  if (prior && prior !== owner) errors.push(`EXECUTION_DUPLICATE: ${prior} and ${owner}`);
  executableSignatures.set(signature, owner);
}

const ci = read('.github/workflows/ci.yml');
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

const result = {
  schema_version: 8,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  executionOwnerCount: executionOwners.size,
  implementationCount: implementations.length,
  implementationKindCounts: implementations.reduce((acc, item) => { acc[item.implementation?.kind ?? 'unknown'] = (acc[item.implementation?.kind ?? 'unknown'] ?? 0) + 1; return acc; }, {}),
  markerCount: markerRefs.length,
  architecture: { engines: ['static+build', 'browser-fast', 'browser-deep', 'certify'], browserFast: { tools: 22, browsers: 3, units: 66 }, browserDeep: { locales: 20, browsers: 3 } },
  architectureChecks: architectureChecks.map(([label, pass]) => ({ label, status: pass ? 'PASS' : 'FAIL' })),
  implementations,
  errors,
};
fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
