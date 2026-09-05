import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = process.cwd();
const distPath = path.join(root, 'dist');
const indexPath = path.join(distPath, 'index.html');
const reportDir = path.join(root, 'diagnostics');
const reportPath = path.join(reportDir, 'performance-baseline.json');
const budgetPath = path.join(root, 'performance-budget.json');

if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
  console.error('Performance baseline requires a built dist/ directory and dist/index.html.');
  process.exit(1);
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function relativeAssetPath(filePath) {
  return path.relative(distPath, filePath).replaceAll(path.sep, '/');
}

function normalizeAssetReference(value) {
  const withoutQuery = value.split(/[?#]/u, 1)[0] ?? '';
  return withoutQuery.replace(/^\/+/, '');
}

function getCriticalJavascriptReferences() {
  const html = fs.readFileSync(indexPath, 'utf8');
  const references = new Set();
  const attributePattern = /<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/giu;

  for (const match of html.matchAll(attributePattern)) {
    const asset = normalizeAssetReference(match[1]);
    if (/\.m?js$/i.test(asset)) references.add(asset);
  }

  return references;
}

const files = walk(distPath).map((filePath) => {
  const bytes = fs.readFileSync(filePath);
  const file = relativeAssetPath(filePath);
  return {
    file,
    bytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
    brotliBytes: brotliCompressSync(bytes).byteLength,
  };
});

const javascript = files.filter((entry) => /\.m?js$/i.test(entry.file));
const css = files.filter((entry) => /\.css$/i.test(entry.file));
const assetMap = new Map(files.map((entry) => [entry.file, entry]));
const criticalJavascript = [...getCriticalJavascriptReferences()]
  .map((reference) => assetMap.get(reference))
  .filter(Boolean);

const totalBytes = files.reduce((sum, entry) => sum + entry.bytes, 0);
const totalJavaScriptBytes = javascript.reduce((sum, entry) => sum + entry.bytes, 0);
const totalCssBytes = css.reduce((sum, entry) => sum + entry.bytes, 0);
const totalGzipBytes = files.reduce((sum, entry) => sum + entry.gzipBytes, 0);
const totalBrotliBytes = files.reduce((sum, entry) => sum + entry.brotliBytes, 0);
const totalJavaScriptGzipBytes = javascript.reduce((sum, entry) => sum + entry.gzipBytes, 0);
const totalJavaScriptBrotliBytes = javascript.reduce((sum, entry) => sum + entry.brotliBytes, 0);
const totalCssGzipBytes = css.reduce((sum, entry) => sum + entry.gzipBytes, 0);
const totalCssBrotliBytes = css.reduce((sum, entry) => sum + entry.brotliBytes, 0);
const criticalJavascriptBytes = criticalJavascript.reduce((sum, entry) => sum + entry.bytes, 0);
const criticalJavascriptGzipBytes = criticalJavascript.reduce((sum, entry) => sum + entry.gzipBytes, 0);
const criticalJavascriptBrotliBytes = criticalJavascript.reduce((sum, entry) => sum + entry.brotliBytes, 0);

const largestJavaScript = [...javascript].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
const largestCss = [...css].sort((a, b) => b.bytes - a.bytes).slice(0, 10);

const report = {
  generatedAt: new Date().toISOString(),
  source: 'production-build',
  assets: {
    count: files.length,
    javascriptBytes: totalJavaScriptBytes,
    cssBytes: totalCssBytes,
    totalAssetBytes: totalBytes,
    gzipBytes: totalGzipBytes,
    brotliBytes: totalBrotliBytes,
    javascriptGzipBytes: totalJavaScriptGzipBytes,
    javascriptBrotliBytes: totalJavaScriptBrotliBytes,
    cssGzipBytes: totalCssGzipBytes,
    cssBrotliBytes: totalCssBrotliBytes,
    criticalJavascriptBytes,
    criticalJavascriptGzipBytes,
    criticalJavascriptBrotliBytes,
  },
  budgets: {
    criticalJavascriptBytes: budget.criticalJavascriptBytes,
    javascriptBytes: budget.javascriptBytes,
    cssBytes: budget.cssBytes,
    totalAssetBytes: budget.totalAssetBytes,
  },
  headroomBytes: {
    criticalJavascript: budget.criticalJavascriptBytes - criticalJavascriptBytes,
    javascript: budget.javascriptBytes - totalJavaScriptBytes,
    css: budget.cssBytes - totalCssBytes,
    total: budget.totalAssetBytes - totalBytes,
  },
  criticalJavascript,
  largestJavaScript,
  largestCss,
  note: 'Core Web Vitals, main-thread cost, memory usage, route loading, and user-processing timings remain runtime/field metrics and are intentionally not fabricated by this build baseline. Compression metrics are evidence for later budget tuning.',
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Performance baseline written to ${path.relative(root, reportPath)}`);
console.log(JSON.stringify(report.assets));
console.log('Critical JavaScript assets:');
for (const entry of criticalJavascript) {
  console.log(`- ${entry.file}: ${(entry.bytes / 1024).toFixed(1)} KiB raw, ${(entry.gzipBytes / 1024).toFixed(1)} KiB gzip, ${(entry.brotliBytes / 1024).toFixed(1)} KiB brotli`);
}
console.log('Largest JavaScript assets:');
for (const entry of largestJavaScript) {
  console.log(`- ${entry.file}: ${(entry.bytes / 1024).toFixed(1)} KiB raw, ${(entry.gzipBytes / 1024).toFixed(1)} KiB gzip, ${(entry.brotliBytes / 1024).toFixed(1)} KiB brotli`);
}
