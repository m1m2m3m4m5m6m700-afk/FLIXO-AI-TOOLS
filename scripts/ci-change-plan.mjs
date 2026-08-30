import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.env.CI_BASE_REF || 'origin/main';
const sha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const rules = [
  [/^src\/lib\/i18n\//, ['localization', 'e2e']],
  [/^src\/routes\/.*image-compressor/, ['localization', 'e2e']],
  [/^src\/seo\//, ['seo']],
  [/^tests\//, ['e2e']],
  [/^playwright\.config\.ts$/, ['e2e']],
  [/^\.github\/workflows\//, ['ci', 'full']],
  [/^(package\.json|package-lock\.json)$/, ['security', 'full']],
  [/^scripts\//, ['contracts']],
];

const affected = new Set();
let unknown = false;
for (const file of changed) {
  let matched = false;
  for (const [pattern, gates] of rules) {
    if (pattern.test(file)) {
      matched = true;
      gates.forEach((gate) => affected.add(gate));
    }
  }
  if (!matched) unknown = true;
}

const risk = unknown || affected.has('full') ? 'full' : affected.size ? 'targeted' : 'low';
const plan = {
  schema_version: 1,
  sha,
  base,
  changed_files: changed.length,
  risk,
  unknown,
  affected_gates: [...affected].sort(),
  full_certification_required: risk === 'full',
};

console.log(JSON.stringify(plan, null, 2));
if (process.env.CI_PLAN_OUTPUT) {
  const output = process.env.CI_PLAN_OUTPUT;
  await import('node:fs').then(({ writeFileSync }) => writeFileSync(output, JSON.stringify(plan, null, 2) + '\n'));
}
