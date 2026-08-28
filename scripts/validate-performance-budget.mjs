import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgetPath = path.join(root, 'performance-budget.json');
const distPath = path.join(root, 'dist');
const clientPath = path.join(distPath, 'client');
const outputPath = fs.existsSync(clientPath) ? clientPath : distPath;
const indexPath = path.join(outputPath, 'index.html');

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
  console.error('Performance budget validation requires a built dist/ directory and index.html entrypoint.');
  process.exit(1);
}

let javascriptBytes = 0;
let cssBytes = 0;
let criticalJavascriptBytes = 0;
let initialPayloadBytes = 0;
let lazyJavascriptBytes = 0;
const assets = [];
const criticalJavascriptAssets = [];
const lazyJavascriptAssets = [];
const deferredWorkerAssets = [];
const nonRuntimeAssets = [];

function isDeferredWorkerAsset(relativePath) {
  return /(?:^|\/)(?:pdf\.worker|.*\.worker)(?:[-.][^/]*)?\.m?js$/i.test(relativePath);
}

function isNonRuntimeAsset(relativePath) {
  return /^(?:sitemap\.xml|robots\.txt)$/i.test(relativePath) || /\.html$/i.test(relativePath);
}

function normalizeAssetReference(value) {
  const withoutQuery = value.split(/[?#]/u, 1)[0] ?? '';
  return withoutQuery.replace(/^\/+/, '');
}

function getInitialAssetReferences() {
  const html = fs.readFileSync(indexPath, 'utf8');
  const references = new Set();
  const attributePattern = /<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/giu;

  for (const match of html.matchAll(attributePattern)) {
    const asset = normalizeAssetReference(match[1]);
    if (asset) references.add(asset);
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
    const relativePath = path.relative(outputPath, fullPath).replaceAll(path.sep, '/');
    assets.push({ path: relativePath, bytes });

    if (isNonRuntimeAsset(relativePath)) {
      nonRuntimeAssets.push({ path: relativePath, bytes });
      continue;
    }
    if (isDeferredWorkerAsset(relativePath)) {
      deferredWorkerAssets.push({ path: relativePath, bytes });
      continue;
    }

    if (/\.m?js$/i.test(entry.name)) javascriptBytes += bytes;
    if (/\.css$/i.test(entry.name)) cssBytes += bytes;
  }
}

walk(outputPath);

const assetMap = new Map(assets.map((asset) => [asset.path, asset]));
for (const reference of getInitialAssetReferences()) {
  const asset = assetMap.get(reference) ?? assetMap.get(reference.replace(/^assets\//u, ''));
  if (!asset || isDeferredWorkerAsset(asset.path) || isNonRuntimeAsset(asset.path)) continue;
  initialPayloadBytes += asset.bytes;
  if (/\.m?js$/i.test(asset.path)) {
    criticalJavascriptAssets.push(asset);
    criticalJavascriptBytes += asset.bytes;
  }
}

for (const asset of assets) {
  if (isNonRuntimeAsset(asset.path) || isDeferredWorkerAsset(asset.path)) continue;
  if (/\.m?js$/i.test(asset.path) && !criticalJavascriptAssets.some((critical) => critical.path === asset.path)) {
    lazyJavascriptAssets.push(asset);
    lazyJavascriptBytes += asset.bytes;
  }
}

const checks = [
  ['Critical JavaScript', criticalJavascriptBytes, budget.criticalJavascriptBytes],
  ['JavaScript', javascriptBytes, budget.javascriptBytes],
  ['CSS', cssBytes, budget.cssBytes],
  ['Initial payload (HTML-referenced runtime assets)', initialPayloadBytes, budget.initialPayloadBytes ?? budget.totalAssetBytes],
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
for (const asset of criticalJavascriptAssets) console.log(`  critical ${asset.path} ${(asset.bytes / 1024).toFixed(1)} KiB`);
console.log(`Lazy JavaScript (available but not referenced by the initial HTML): ${(lazyJavascriptBytes / 1024 / 1024).toFixed(2)} MiB across ${lazyJavascriptAssets.length} assets.`);
console.log('Runtime budget semantics: initial HTML-referenced payload is enforced; lazy tool/locale chunks are reported separately and are not counted as initial navigation bytes.');

if (nonRuntimeAssets.length) {
  const nonRuntimeBytes = nonRuntimeAssets.reduce((total, asset) => total + asset.bytes, 0);
  console.log(`Non-runtime documents/artifacts excluded from runtime budget: ${(nonRuntimeBytes / 1024 / 1024).toFixed(2)} MiB`);
}
if (deferredWorkerAssets.length) {
  const workerBytes = deferredWorkerAssets.reduce((total, asset) => total + asset.bytes, 0);
  console.log(`Deferred worker assets excluded from initial runtime budget: ${(workerBytes / 1024 / 1024).toFixed(2)} MiB`);
  for (const asset of deferredWorkerAssets) console.log(`  worker ${asset.path} ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB`);
}

if (failed) {
  console.error('Largest initial runtime assets:');
  for (const asset of [...criticalJavascriptAssets].sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
    console.error(`  ${(asset.bytes / 1024 / 1024).toFixed(2)} MiB  ${asset.path}`);
  }
  process.exit(1);
}
