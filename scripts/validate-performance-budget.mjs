import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgetPath = path.join(root, 'performance-budget.json');
const distPath = path.join(root, 'dist');
const candidateIndexPaths = [path.join(distPath, 'index.html'), path.join(distPath, 'client', 'index.html')];
const indexPath = candidateIndexPaths.find((candidate) => fs.existsSync(candidate));

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

if (!fs.existsSync(distPath) || !indexPath) {
  console.error('Performance budget validation requires a built dist/ directory and an index.html entrypoint.');
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
  return /(?:^|\\/)(?:pdf\\.worker|.*\\.worker)(?:[-.][^/]*)?\\.m?js$/i.test(relativePath);
}

function isNonRuntimeAsset(relativePath) {
  return /^(?:sitemap\\.xml|robots\\.txt)$/i.test(relativePath);
}

function normalizeAssetReference(value) {
  const withoutQuery = value.split(/[?#]/u, 1)[0] ?? '';
  return withoutQuery.replace(/^\\/+/, '');
}

function getCriticalJavascriptReferences() {
  const html = fs.readFileSync(indexPath, 'utf8');
  const references = new Set();
  const attributePattern = /<(?:script|link)\\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/giu;

  for (const match of html.matchAll(attributePattern)) {
    const asset = normalizeAssetReference(match[1]);
    if (/\\.m?js$/i.test(asset)) references.add(asset);
  }

  return references;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const bytes = fs.statSync(fullPath).size;
    const relativePath = path.relative(distPath, fullPath).replaceAll(path.sep, '/');

    assets.push({ path: relativePath, bytes });

    if (isNonRuntimeAsset(relativePath)) {
      nonRuntimeAssets.push({ path: relativePath, bytes });
      continue;
    }

    totalAssetBytes += bytes;

    if (/\\.m?js$/i.test(entry.name)) {
      if (isDeferredWorkerAsset(relativePath)) deferredWorkerAssets.push({ path: relativePath, bytes });
      else javascriptBytes += bytes;
    }
    if (/\\.css$/i.test(entry.name)) cssBytes += bytes;
  }
}

walk(distPath);

const clientIndexPrefix = path.relative(distPath, path.dirname(indexPath)).replaceAll(path.sep, '/');
const assetMap = new Map(assets.map((asset) => [asset.path, asset]));
for (const reference of getCriticalJavascriptReferences()) {
  const direct = assetMap.get(reference);
  const prefixed = clientIndexPrefix && clientIndexPrefix !== '.' ? assetMap.get(`${clientIndexPrefix}/${reference}`) : undefined;
  const asset = direct ?? prefixed;
  if (!asset || isDeferredWorkerAsset(asset.path)) continue;
  criticalJavascriptAssets.push(asset);
  criticalJavascriptBytes += asset.bytes;
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

console.log(`Critical JavaScript assets discovered from ${path.relative(root, indexPath)}: ${criticalJavascriptAssets.length}`);
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
  console.log(`Deferred worker assets excluded from critical JavaScript budget: ${(workerBytes / 1024 / 1024).toFixed(2)} MiB`);
  for (const asset of deferredWorkerAssets) {
    console.log(`  worker ${asset.path} ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB`);
  }
}

if (failed) {
  const largestAssets = assets
    .filter((asset) => !isNonRuntimeAsset(asset.path))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);
  console.error('Largest runtime assets:');
  for (const asset of largestAssets) {
    console.error(`  ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB  ${asset.path}`);
  }
  process.exit(1);
}
