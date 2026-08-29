import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.resolve(root, process.env.FLIXO_PERFORMANCE_BASELINE ?? 'diagnostics/performance-baseline.json');
const failures = [];
const requiredAssetKeys = [
  'count',
  'javascriptBytes',
  'cssBytes',
  'totalAssetBytes',
  'gzipBytes',
  'brotliBytes',
  'javascriptGzipBytes',
  'javascriptBrotliBytes',
  'cssGzipBytes',
  'cssBrotliBytes',
  'criticalJavascriptBytes',
  'criticalJavascriptGzipBytes',
  'criticalJavascriptBrotliBytes',
];
const requiredBudgetKeys = [
  'criticalJavascriptBytes',
  'javascriptBytes',
  'cssBytes',
  'totalAssetBytes',
];

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`Performance baseline: FAIL - cannot read ${path.relative(root, reportPath)} (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}

if (!report || typeof report !== 'object' || Array.isArray(report)) {
  failures.push('baseline report must be a JSON object');
} else {
  if (report.source !== 'production-build') failures.push('source must be production-build');
  if (typeof report.generatedAt !== 'string' || Number.isNaN(Date.parse(report.generatedAt))) failures.push('generatedAt must be a valid timestamp');

  for (const key of requiredAssetKeys) {
    if (!Number.isSafeInteger(report.assets?.[key]) || report.assets[key] < 0) failures.push(`assets.${key} must be a non-negative integer`);
  }
  for (const key of requiredBudgetKeys) {
    if (!Number.isSafeInteger(report.budgets?.[key]) || report.budgets[key] <= 0) failures.push(`budgets.${key} must be a positive integer`);
  }

  if (Array.isArray(report.criticalJavascript)) {
    const computedCritical = report.criticalJavascript.reduce((sum, asset) => sum + (Number.isSafeInteger(asset?.bytes) ? asset.bytes : 0), 0);
    if (computedCritical !== report.assets?.criticalJavascriptBytes) failures.push('assets.criticalJavascriptBytes does not match criticalJavascript entries');
  } else {
    failures.push('criticalJavascript must be an array');
  }

  const headroom = report.headroomBytes;
  for (const [name, budgetKey] of [
    ['criticalJavascript', 'criticalJavascriptBytes'],
    ['javascript', 'javascriptBytes'],
    ['css', 'cssBytes'],
    ['total', 'totalAssetBytes'],
  ]) {
    if (!Number.isSafeInteger(headroom?.[name])) failures.push(`headroomBytes.${name} must be an integer`);
    else if (headroom[name] !== report.budgets[budgetKey] - report.assets[budgetKey]) failures.push(`headroomBytes.${name} is inconsistent with assets and budgets`);
    else if (headroom[name] < 0) failures.push(`headroomBytes.${name} is negative`);
  }

  if (report.assets?.javascriptBytes > report.assets?.totalAssetBytes) failures.push('JavaScript bytes exceed total asset bytes');
  if (report.assets?.cssBytes > report.assets?.totalAssetBytes) failures.push('CSS bytes exceed total asset bytes');
  if (report.assets?.criticalJavascriptBytes > report.assets?.javascriptBytes) failures.push('critical JavaScript bytes exceed total JavaScript bytes');

  if (!Array.isArray(report.largestJavaScript) || !Array.isArray(report.largestCss)) failures.push('largest asset inventories must be arrays');
  if (typeof report.note !== 'string' || !report.note.includes('Core Web Vitals')) failures.push('baseline note must state that runtime/field metrics are not fabricated');
}

if (failures.length) {
  console.error('Performance baseline: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Performance baseline: PASS');
console.log(`source: ${report.source}`);
console.log(`generatedAt: ${report.generatedAt}`);
console.log(`critical headroom: ${report.headroomBytes.criticalJavascript} bytes`);
console.log(`javascript headroom: ${report.headroomBytes.javascript} bytes`);
console.log(`css headroom: ${report.headroomBytes.css} bytes`);
console.log(`total headroom: ${report.headroomBytes.total} bytes`);
