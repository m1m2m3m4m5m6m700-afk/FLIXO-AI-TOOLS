import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const dependencyNames = Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) });
const roots = ['src', 'scripts', 'tests', '.github'];
const ignored = new Set(['node_modules', 'dist', '.git', 'coverage']);

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (/\.(?:[cm]?[jt]sx?|json|yml|yaml)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const source = roots.flatMap(walk).map((file) => ({
  file: relative('.', file).replaceAll('\\', '/'),
  content: readFileSync(file, 'utf8'),
}));

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function usageFor(name) {
  const pattern = new RegExp(`(?:from\\s+|import\\s*\\(|require\\s*\\()[\\'\"]${escapeRegex(name)}(?:/[^\'\"]*)?[\'\"]`, 'g');
  return source.flatMap(({ file, content }) => {
    const count = content.match(pattern)?.length ?? 0;
    return count ? [{ file, count }] : [];
  });
}

const entries = dependencyNames.map((name) => {
  const files = usageFor(name);
  const declaredIn = packageJson.dependencies?.[name] ? 'dependencies' : 'devDependencies';
  const classification = files.length
    ? 'used'
    : declaredIn === 'devDependencies'
      ? 'build-or-tooling-unconfirmed'
      : 'no-source-usage-found';
  return { name, declaredIn, classification, files, totalMatches: files.reduce((sum, item) => sum + item.count, 0) };
}).sort((a, b) => a.name.localeCompare(b.name));

const summary = entries.reduce((acc, entry) => {
  acc.total += 1;
  acc[entry.classification] += 1;
  return acc;
}, { total: 0, used: 0, 'no-source-usage-found': 0, 'build-or-tooling-unconfirmed': 0 });

const report = { generatedAt: new Date().toISOString(), roots, summary, entries };
const jsonPath = process.env.DEPENDENCY_USAGE_JSON;
if (jsonPath) {
  mkdirSync('diagnostics', { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log('Dependency usage classification');
console.log(`Declared: ${summary.total}`);
console.log(`Used: ${summary.used}`);
console.log(`No source usage found: ${summary['no-source-usage-found']}`);
console.log(`Dev/build/tooling unconfirmed: ${summary['build-or-tooling-unconfirmed']}`);
for (const entry of entries) console.log(`${entry.name}: ${entry.classification} (${entry.totalMatches} matches)`);
