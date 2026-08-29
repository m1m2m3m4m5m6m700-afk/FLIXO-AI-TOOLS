import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const base = process.env.CI_BASE_SHA || 'HEAD~1';
const head = process.env.CI_HEAD_SHA || 'HEAD';
const raw = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' });
const files = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

const rules = [
  { lane: 'full-certification', patterns: [/^package-lock\.json$/, /^package\.json$/, /^\.nvmrc$/, /^vite\.config\./, /^playwright\.config\./, /^\.github\/workflows\//, /^scripts\//] },
  { lane: 'security', patterns: [/^src\//, /^public\//, /^server\//, /secret|credential|token/i] },
  { lane: 'localization', patterns: [/i18n|locale|language|translation|messages/i] },
  { lane: 'seo', patterns: [/seo|sitemap|robots|canonical|hreflang|metadata/i] },
  { lane: 'e2e', patterns: [/^tests\//, /playwright/i] },
  { lane: 'static', patterns: [/\.(ts|tsx|js|jsx|mjs|json|css|scss)$/] },
];

const affected = new Set();
let unknown = false;
for (const file of files) {
  let matched = false;
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(file))) {
      affected.add(rule.lane);
      matched = true;
    }
  }
  if (!matched) unknown = true;
}

let lane = 'targeted';
if (files.length === 0) lane = 'full-certification';
else if (unknown || affected.has('full-certification')) lane = 'full-certification';
else if (files.every((file) => /^(docs\/|README|CHANGELOG|.*\.md$)/i.test(file))) lane = 'fast';

const result = {
  version: 1,
  base,
  head,
  files,
  affected: [...affected].sort(),
  unknown,
  lane,
  failClosed: true,
  rule: lane === 'full-certification' ? 'unknown-or-high-impact' : lane,
};

writeFileSync('diagnostics/ci-risk-plan.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
