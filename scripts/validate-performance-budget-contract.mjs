import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgetPath = path.resolve(root, process.env.FLIXO_PERFORMANCE_BUDGET ?? 'performance-budget.json');
const failures = [];

const expectedKeys = [
  'criticalJavascriptBytes',
  'javascriptBytes',
  'cssBytes',
  'totalAssetBytes',
  'notes',
];

const releaseCeilings = {
  criticalJavascriptBytes: 921600,
  javascriptBytes: 3145728,
  cssBytes: 1048576,
  totalAssetBytes: 5242880,
};

let budget;
try {
  budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
} catch (error) {
  console.error(`Performance budget contract: FAIL - cannot read ${path.relative(root, budgetPath)} (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}

if (!budget || typeof budget !== 'object' || Array.isArray(budget)) {
  failures.push('performance budget must be a JSON object');
} else {
  const actualKeys = Object.keys(budget).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(requiredKeys)) {
    failures.push(`performance budget keys must be exactly: ${requiredKeys.join(', ')}`);
  }

  for (const key of Object.keys(releaseCeilings)) {
    const value = budget[key];
    const limit = releaseCeilings[key];
    if (!Number.isSafeInteger(value) || value <= 0) {
      failures.push(`${key} must be a positive integer`);
      continue;
    }
    if (value > limit) failures.push(`${key} must not exceed release ceiling ${limit}`);
  }

  if (typeof budget.notes !== 'string' || budget.notes.trim() === '') failures.push('notes must be a non-empty string');

  const { criticalJavascriptBytes, javascriptBytes, cssBytes, totalAssetBytes } = budget;
  if (
    Number.isSafeInteger(criticalJavascriptBytes) &&
    Number.isSafeInteger(javascriptBytes) &&
    criticalJavascriptBytes > javascriptBytes
  ) failures.push('criticalJavascriptBytes must not exceed javascriptBytes');
  if (
    Number.isSafeInteger(javascriptBytes) &&
    Number.isSafeInteger(totalAssetBytes) &&
    javascriptBytes > totalAssetBytes
  ) failures.push('javascriptBytes must not exceed totalAssetBytes');
  if (
    Number.isSafeInteger(cssBytes) &&
    Number.isSafeInteger(totalAssetBytes) &&
    cssBytes > totalAssetBytes
  ) failures.push('cssBytes must not exceed totalAssetBytes');
}

if (failures.length) {
  console.error('Performance budget contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Performance budget contract: PASS');
console.log(`source: ${path.relative(root, budgetPath)}`);
console.log(`criticalJavascriptBytes: ${budget.criticalJavascriptBytes}`);
console.log(`javascriptBytes: ${budget.javascriptBytes}`);
console.log(`cssBytes: ${budget.cssBytes}`);
console.log(`totalAssetBytes: ${budget.totalAssetBytes}`);
