import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgetPath = path.join(root, 'performance-budget.json');
const distPath = path.join(root, 'dist');
const clientPath = path.join(distPath, 'client');

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

if (!fs.existsSync(distPath) || !fs.existsSync(clientPath)) {
  console.error('Performance budget validation requires a built dist/client/ directory.');
  process.exit(1);
}

let javascriptBytes = 0;
let cssBytes = 0;
let totalAssetBytes = 0;
let criticalJavascriptBytes = 0;
const assets = [];
const criticalJavascriptAssets = [];
const deferredWorkerAssets = [];
const nonRuntimeAssets = [];

function isDeferredWorkerAsset(relativePath) {
  return /(?:^|\/)(?:pdf\.worker|.*\.worker)(?:[-.][^/]*)?\.m?js$/i.test(relativePath);
}

function isNonRuntimeAsset(relativePath) {
  return /(?:^|\/)(?:sitemap\.xml|robots\.txt)$/i.test(relativePath);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const bytes = fs.statSync(fullPath).size;
    const relativePath = path.relative(clientPath, fullPath).replaceAll(path.sep, '/');
    assets.push({ path: relativePath, bytes });

    if (isNonRuntimeAsset(relativePath)) {
      nonRuntimeAssets.push({ path: relativePath, bytes });
      continue;
    }

    if (isDeferredWorkerAsset(relativePath)) {
      deferredWorkerAssets.push({ path: relativePath, bytes });
      continue;
    }

    totalAssetBytes += bytes;
    if (/\.m?js$/i.test(entry.name)) javascriptBytes += bytes;
    if (/\.css$/i.test(entry.name)) cssBytes += bytes;
  }
}

walk(clientPath);

for (const asset of assets) {
  if (/^assets\/index-[^/]+\.m?js$/i.test(asset.path)) {
    criticalJavascriptAssets.push(asset);
    criticalJavascriptBytes += asset.bytes;
  }
}

const checks = [
  ['Critical JavaScript', criticalJavascriptBytes, budget.criticalJavascriptBytes],
  ['JavaScript', javascriptBytes, budget.javascriptBytes],
  ['CSS', cssBytes, budget.cssBytes],
  ['Total runtime assets', totalAssetBytes, budget.totalAssetBytes],
];

let failed = false;
for (const [label, actual, limit] of checks) {
  const actualKiB = (actual / 1024).toFixed(1);
  const limitKiB = (limit / 1024).toFixed(1);
  if (actual > limit) {
    console.error(`Performance budget exceeded: ${label} ${actualKiB} KiB > ${limitKiB} KiB`);
    failed = true;
  } else {
    console.log(`Performance budget OK: ${label} ${actualKiB} KiB <= ${limitKiB} KiB`);
  }
}

console.log(`Critical JavaScript assets discovered from TanStack Start client output: ${criticalJavascriptAssets.length}`);
for (const asset of criticalJavascriptAssets) {
  console.log(`  critical ${asset.path} ${(asset.bytes / 1024).toFixed(1)} KiB`);
}

if (nonRuntimeAssets.length) {
  const nonRuntimeBytes = nonRuntimeAssets.reduce((total, asset) => total + asset.bytes, 0);
  console.log(`Non-runtime artifacts excluded from runtime asset budget: ${(nonRuntimeBytes / 1024 / 1024).toFixed(2)} MiB`);
  for (const asset of nonRuntimeAssets) {
    console.log(`  artifact ${asset.path} ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB`);
  }
}

if (deferredWorkerAssets.length) {
  const workerBytes = deferredWorkerAssets.reduce((total, asset) => total + asset.bytes, 0);
  console.log(`Deferred worker assets excluded from runtime budgets: ${(workerBytes / 1024 / 1024).toFixed(2)} MiB`);
  for (const asset of deferredWorkerAssets) {
    console.log(`  worker ${asset.path} ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB`);
  }
}

if (failed) {
  const largestAssets = assets
    .filter((asset) => !isNonRuntimeAsset(asset.path) && !isDeferredWorkerAsset(asset.path))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);
  console.error('Largest runtime assets:');
  for (const asset of largestAssets) {
    console.error(`  ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB  ${asset.path}`);
  }
  process.exit(1);
}
