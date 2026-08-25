import { spawnSync } from 'node:child_process';

const forbidden = ['tsconfck', '@esbuild-kit'];
const deprecatedRoots = ['vite-tsconfig-paths', 'drizzle-kit'];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function packageTree() {
  const result = run('npm', ['ls', '--all', '--json', '--omit=optional']);
  if (result.status !== 0 && !result.stdout.trim()) {
    throw new Error(`npm ls failed: ${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout || '{}');
  } catch (error) {
    throw new Error(`Unable to parse npm ls JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function collectNames(node, names = new Set()) {
  for (const [name, entry] of Object.entries(node?.dependencies ?? {})) {
    names.add(name);
    collectNames(entry, names);
  }
  return names;
}

const tree = packageTree();
const names = collectNames(tree);
const forbiddenMatches = [...names].filter((name) => forbidden.some((prefix) => name === prefix || name.startsWith(`${prefix}/`)));
const deprecatedRootMatches = deprecatedRoots.filter((name) => Object.hasOwn(tree.dependencies ?? {}, name));

console.log(`Dependency tree packages inspected: ${names.size}`);
console.log(`Forbidden transitive packages: ${forbiddenMatches.length}`);
console.log(`Deprecated root packages: ${deprecatedRootMatches.length}`);

if (forbiddenMatches.length || deprecatedRootMatches.length) {
  if (forbiddenMatches.length) console.error(`Forbidden packages found: ${forbiddenMatches.join(', ')}`);
  if (deprecatedRootMatches.length) console.error(`Deprecated roots found: ${deprecatedRootMatches.join(', ')}`);
  process.exit(1);
}

const audit = run('npm', ['audit', '--json']);
let auditJson;
try {
  auditJson = JSON.parse(audit.stdout || '{}');
} catch (error) {
  throw new Error(`Unable to parse npm audit JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const vulnerabilities = auditJson?.metadata?.vulnerabilities ?? {};
const total = Number(vulnerabilities.total ?? 0);
console.log(`npm audit vulnerabilities: ${total}`);
if (total !== 0) {
  console.error(JSON.stringify(vulnerabilities, null, 2));
  process.exit(1);
}

console.log('Dependency zero-debt gate: PASS');
