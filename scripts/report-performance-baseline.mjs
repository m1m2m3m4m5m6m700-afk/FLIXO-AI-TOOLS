import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distPath = path.join(root, 'dist');
const reportDir = path.join(root, 'diagnostics');
const reportPath = path.join(reportDir, 'performance-baseline.json');
const budgetPath = path.join(root, 'performance-budget.json');

if (!fs.existsSync(distPath)) {
  console.error('Performance baseline requires a built dist/ directory.');
  process.exit(1);
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

let javascriptBytes = 0;
let cssBytes = 0;
let totalAssetBytes = 0;
let assetCount = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    const bytes = fs.statSync(fullPath).size;
    totalAssetBytes += bytes;
    assetCount += 1;
    if (/\.m?js$/.test(entry.name)) javascriptBytes += bytes;
    if (/\.css$/.test(entry.name)) cssBytes += bytes;
  }
}

walk(distPath);

const report = {
  generatedAt: new Date().toISOString(),
  source: 'production-build',
  assets: {
    count: assetCount,
    javascriptBytes,
    cssBytes,
    totalAssetBytes,
  },
  budgets: {
    javascriptBytes: budget.javascriptBytes,
    cssBytes: budget.cssBytes,
    totalAssetBytes: budget.totalAssetBytes,
  },
  headroomBytes: {
    javascript: budget.javascriptBytes - javascriptBytes,
    css: budget.cssBytes - cssBytes,
    total: budget.totalAssetBytes - totalAssetBytes,
  },
  note: 'Core Web Vitals and user-processing timings remain runtime/field metrics and are intentionally not fabricated by this build baseline.',
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Performance baseline written to ${path.relative(root, reportPath)}`);
console.log(JSON.stringify(report.assets));
