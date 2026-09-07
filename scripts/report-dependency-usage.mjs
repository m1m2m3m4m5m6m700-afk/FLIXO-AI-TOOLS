import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, join, relative } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
const dependencyNames = Object.keys(declared).sort((a, b) => a.localeCompare(b));

const ignored = new Set(['node_modules', 'dist', '.git', 'coverage', '.next', '.cache']);
const sourceRoots = ['src', 'scripts', 'tests', '.github'];
const rootConfigFiles = [
  'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs',
  'eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts',
  'playwright.config.ts', 'playwright.config.js',
  'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs',
  'tsconfig.json', 'tsconfig.node.json', 'package.json',
];

const legacyNames = new Set([
  '@ffmpeg/core', '@ffmpeg/ffmpeg', '@types/gif.js', 'gif.js', 'gifuct-js',
  'pdf-lib', 'pdfjs-dist', 'jspdf', 'nodemailer', '@types/nodemailer',
  'drizzle-orm', 'postgres', 'drizzle-kit', 'vite-tsconfig-paths',
]);

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (/\.(?:[cm]?[jt]sx?|json|ya?ml|md)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const files = [
  ...sourceRoots.flatMap((root) => walk(root)),
  ...rootConfigFiles.filter((file) => existsSync(file)),
].filter((file, index, all) => all.indexOf(file) === index);

const source = files.map((file) => ({
  file: relative('.', file).replaceAll('\\', '/'),
  content: readFileSync(file, 'utf8'),
}));

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function usageFor(name) {
  const pattern = new RegExp(
    `(?:from\\s*|import\\s*\\(|require\\s*\\(|require\\.resolve\\s*\\()\\s*["']${escapeRegex(name)}(?:/[^"']*)?["']`,
    'g',
  );
  return source.flatMap(({ file, content }) => {
    const count = content.match(pattern)?.length ?? 0;
    return count ? [{ file, count }] : [];
  });
}

function roleFor(file) {
  if (file.startsWith('tests/') || /(?:^|[/_.-])(?:test|tests|spec|e2e)(?:[/_.-]|$)/i.test(file)) {
    return 'USED_TEST';
  }
  if (file.startsWith('src/')) return 'USED_RUNTIME';
  if (file.startsWith('scripts/') || file.startsWith('.github/') || rootConfigFiles.includes(file)) {
    return 'USED_BUILD';
  }
  return 'USED_BUILD';
}

const entries = dependencyNames.map((name) => {
  const usage = usageFor(name).map((item) => ({ ...item, role: roleFor(item.file) }));
  const roles = new Set(usage.map((item) => item.role));
  let classification = 'UNUSED';
  if (legacyNames.has(name)) classification = 'LEGACY';
  else if (roles.has('USED_RUNTIME')) classification = 'USED_RUNTIME';
  else if (roles.has('USED_TEST')) classification = 'USED_TEST';
  else if (roles.has('USED_BUILD')) classification = 'USED_BUILD';

  return {
    name,
    declaredIn: packageJson.dependencies?.[name] ? 'dependencies' : 'devDependencies',
    version: declared[name],
    classification,
    files: usage,
    totalMatches: usage.reduce((sum, item) => sum + item.count, 0),
  };
});

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const lockPackages = Object.keys(lock.packages ?? {});
const transitiveOnly = lockPackages
  .filter((path) => path !== '')
  .map((path) => path.replace(/^node_modules\//, ''))
  .filter((name, index, all) => all.indexOf(name) === index && !Object.hasOwn(declared, name))
  .sort((a, b) => a.localeCompare(b));

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const install = run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
if (install.status !== 0) {
  console.error(install.stderr.trim() || install.stdout.trim());
  throw new Error(`npm install --package-lock-only failed with exit ${install.status}`);
}

const diff = run('git', ['diff', '--exit-code', '--', 'package-lock.json']);
const lockfileDrift = diff.status !== 0;
if (lockfileDrift) {
  console.error('package-lock.json drift detected after npm install --package-lock-only.');
  console.error(diff.stdout.trim());
}

const npmLs = run('npm', ['ls', '--all', '--json', '--omit=optional']);
let npmLsJson = null;
try {
  npmLsJson = JSON.parse(npmLs.stdout || '{}');
} catch (error) {
  console.error(npmLs.stdout || npmLs.stderr);
  throw new Error(`npm ls JSON parse failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
}
const npmLsBroken = npmLs.status !== 0 || Boolean(npmLsJson?.problems?.length);

const counts = entries.reduce((acc, entry) => {
  acc.total += 1;
  acc[entry.classification] = (acc[entry.classification] ?? 0) + 1;
  return acc;
}, {
  total: 0,
  USED_RUNTIME: 0,
  USED_BUILD: 0,
  USED_TEST: 0,
  TRANSITIVE_ONLY: transitiveOnly.length,
  UNUSED: 0,
  LEGACY: 0,
});

const report = {
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? null,
  sha: process.env.GITHUB_SHA ?? null,
  lockfileVersion: lock.lockfileVersion ?? null,
  npm: {
    installPackageLockOnlyExit: install.status,
    lockfileDrift,
    npmLsExit: npmLs.status,
    npmLsBroken,
  },
  roots: [...sourceRoots, ...rootConfigFiles],
  summary: counts,
  transitiveOnly,
  entries,
};

console.log('Dependency Zero-Debt Classification');
console.log(`SHA: ${report.sha ?? 'UNKNOWN'}`);
console.log(`Direct dependencies inspected: ${counts.total}`);
console.log(`USED_RUNTIME: ${counts.USED_RUNTIME}`);
console.log(`USED_BUILD: ${counts.USED_BUILD}`);
console.log(`USED_TEST: ${counts.USED_TEST}`);
console.log(`TRANSITIVE_ONLY (lockfile): ${counts.TRANSITIVE_ONLY}`);
console.log(`UNUSED: ${counts.UNUSED}`);
console.log(`LEGACY: ${counts.LEGACY}`);
console.log(`npm install --package-lock-only: ${install.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(`package-lock drift: ${lockfileDrift ? 'FAIL' : 'PASS'}`);
console.log(`npm ls: ${npmLsBroken ? 'FAIL' : 'PASS'}`);

for (const entry of entries) {
  const files = entry.files.map((item) => `${item.file}:${item.count}`).join(', ');
  console.log(`${entry.classification.padEnd(13)} ${entry.name} [${entry.declaredIn}] ${files || 'NO_USAGE'}`);
}

const blockers = entries.filter((entry) => entry.classification === 'UNUSED' || entry.classification === 'LEGACY');
if (lockfileDrift || npmLsBroken || blockers.length > 0) {
  if (blockers.length) console.error(`Dependency zero-debt blockers: ${blockers.map((entry) => `${entry.name}=${entry.classification}`).join(', ')}`);
  process.exit(1);
}

console.log('Dependency Zero-Debt Gate: PASS');
