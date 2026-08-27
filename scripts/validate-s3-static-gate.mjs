import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const fail = (message) => {
  console.error(`S3 FAIL: ${message}`);
  process.exit(1);
};
const pass = (message) => console.log(`S3 PASS: ${message}`);
const run = (command, args = []) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (packageJson.type !== 'module') fail('package.json must declare type=module');
if (!packageJson.scripts?.typecheck || !packageJson.scripts?.lint || !packageJson.scripts?.build) {
  fail('required static scripts are missing');
}
pass('package contract');

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) fail('index.html is missing');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('id="root"')) fail('root entrypoint is missing');
if (!indexHtml.includes('src="/src/main.tsx"')) fail('canonical /src/main.tsx entrypoint is missing');
if (!existsSync(join(root, 'src/main.tsx'))) fail('src/main.tsx does not exist');
pass('entrypoint validation');

const manifestPath = join(root, 'public/manifest.webmanifest');
if (!existsSync(manifestPath)) fail('public/manifest.webmanifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
  if (!(key in manifest)) fail(`manifest missing ${key}`);
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) fail('manifest icons are empty');
for (const icon of manifest.icons) {
  if (!icon.src || !existsSync(join(root, 'public', icon.src.replace(/^\//, '')))) {
    fail(`manifest icon is missing: ${icon.src ?? '<empty>'}`);
  }
}
pass('manifest validation');

run('npm', ['run', 'typecheck']);
pass('TypeScript');
run('npm', ['run', 'lint']);
pass('ESLint');
run('npm', ['run', 'build']);
pass('production build');

if (!existsSync(join(dist, 'index.html'))) fail('dist/index.html is missing after build');
const distReal = realpathSync(dist);
const realPathViolations = [];
const visit = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = realpathSync(full);
      const rel = relative(distReal, target);
      if (rel.startsWith('..') || resolve(distReal, rel) !== target) realPathViolations.push(full);
    } else if (entry.isDirectory()) {
      visit(full);
    }
  }
};
visit(dist);
if (realPathViolations.length) fail(`dist contains symlink escapes: ${realPathViolations.join(', ')}`);
pass('realpath containment');

const scriptSrcs = [...readFileSync(join(dist, 'index.html'), 'utf8').matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
if (scriptSrcs.length !== new Set(scriptSrcs).size) fail('duplicate module script references in dist/index.html');
const localScripts = scriptSrcs.filter((src) => src.startsWith('/')).map((src) => join(dist, src.replace(/^\//, '')));
if (localScripts.some((p) => !existsSync(p))) fail(`dist entry script is missing: ${localScripts.find((p) => !existsSync(p))}`);
pass(`unique JS entry graph (${scriptSrcs.length} entry module(s))`);

const maxKiB = 900;
let jsBytes = 0;
const jsFiles = [];
const walkFiles = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full);
    else if (entry.isFile() && full.endsWith('.js')) {
      jsBytes += lstatSync(full).size;
      jsFiles.push(full);
    }
  }
};
walkFiles(dist);
const jsKiB = jsBytes / 1024;
console.log(`S3 BUNDLE JS: ${jsKiB.toFixed(2)} KiB across ${jsFiles.length} file(s)`);
if (jsKiB > maxKiB) fail(`JavaScript bundle budget exceeded: ${jsKiB.toFixed(2)} KiB > ${maxKiB} KiB`);
pass('bundle <= 900 KiB');

const base = process.env.S3_BASE_REF ?? 'origin/main';
try {
  const changedRaw = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).trim();
  const changed = changedRaw ? changedRaw.split('\n').filter(Boolean) : [];
  const allow = new Set([
    'package.json',
    '.github/workflows/ci.yml',
    'scripts/validate-s3-static-gate.mjs',
  ]);
  const unexpected = changed.filter((file) => !allow.has(file));
  if (unexpected.length) fail(`changed-files allowlist violation: ${unexpected.join(', ')}`);
  pass(`changed-files allowlist (${changed.length} file(s))`);
} catch (error) {
  console.error(error?.message ?? error);
  fail(`unable to evaluate changed-files allowlist against ${base}`);
}

try {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (status) fail(`working tree is not clean:\n${status}`);
  pass('working tree clean');
} catch {
  fail('unable to inspect git working tree');
}

pass('S3 STATIC GATE COMPLETE');
