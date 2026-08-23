import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = ['src'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const importPattern = /(?:from\s+|import\(\s*|require\(\s*)["']recharts(?:["'])/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (extensions.has(path.slice(path.lastIndexOf('.')))) files.push(path);
  }
  return files;
}

const matches = [];
for (const sourceRoot of sourceRoots) {
  const files = await walk(join(root, sourceRoot));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (importPattern.test(source)) matches.push(relative(root, file).replaceAll('\\', '/'));
    importPattern.lastIndex = 0;
  }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = packageJson.dependencies?.recharts ?? null;

console.log('Recharts v3 readiness inventory');
console.log(`Declared version: ${version ?? 'not declared'}`);
console.log(`Recharts source files: ${matches.length}`);
for (const file of matches.sort()) console.log(`- ${file}`);

if (!version) process.exitCode = 1;
