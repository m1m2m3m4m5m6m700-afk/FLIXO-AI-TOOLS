import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgetPath = path.join(root, 'performance-budget.json');
const distPath = path.join(root, 'dist');

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

if (!fs.existsSync(distPath)) {
  console.error('Performance budget validation requires a built dist/ directory.');
  process.exit(1);
}

let javascriptBytes = 0;
let cssBytes = 0;
let totalAssetBytes = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    const bytes = fs.statSync(fullPath).size;
    totalAssetBytes += bytes;
    if (/\.m?js$/.test(entry.name)) javascriptBytes += bytes;
    if (/\.css$/.test(entry.name)) cssBytes += bytes;
  }
}

walk(distPath);

const checks = [
  ['JavaScript', javascriptBytes, budget.javascriptBytes],
  ['CSS', cssBytes, budget.cssBytes],
  ['Total assets', totalAssetBytes, budget.totalAssetBytes],
];

let failed = false;
for (const [label, actual, limit] of checks) {
  const actualMiB = (actual / 1024 / 1024).toFixed(2);
  const limitMiB = (limit / 1024 / 1024).toFixed(2);
  if (actual > limit) {
    console.error(`Performance budget exceeded: ${label} ${actualMiB} MiB > ${limitMiB} MiB`);
    failed = true;
  } else {
    console.log(`Performance budget OK: ${label} ${actualMiB} MiB <= ${limitMiB} MiB`);
  }
}

if (failed) process.exit(1);
