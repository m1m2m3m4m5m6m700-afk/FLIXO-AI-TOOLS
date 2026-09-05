import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.CHANGE_BASE || 'origin/main';
let names;
try {
  names = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch {
  console.error(`Cannot resolve change base ${base}; fail-closed to FULL certification.`);
  names = ['__UNKNOWN_BASE__'];
}

const docsOnly = names.length > 0 && names.every((p) => /^(docs\/|README|CHANGELOG|LICENSE|\.github\/ISSUE_TEMPLATE\/)/i.test(p));
const dependency = names.some((p) => /^(package\.json|package-lock\.json|npm-shrinkwrap\.json|\.nvmrc|vite\.config|playwright\.config|tsconfig)/.test(p));
const workflow = names.some((p) => p.startsWith('.github/workflows/'));
const localization = names.some((p) => /^(src\/.*i18n|src\/.*locale|src\/.*localization|tests\/localization|scripts\/validate-(locale|language|localization))/.test(p));
const security = names.some((p) => /^(\.github\/workflows\/.*security|scripts\/.*security|src\/.*(?:auth|security)|package-lock\.json)/.test(p));
const seo = names.some((p) => /^(src\/.*seo|scripts\/.*seo|scripts\/(generate-robots|generate-sitemap)|public\/.*(?:robots|sitemap))/.test(p));
const tools = [...new Set(names.map((p) => p.match(/^src\/tools\/([^/]+)/)?.[1]).filter(Boolean))];
const unknown = names.some((p) => ![docsOnly, localization, security, seo, /^tests\//.test(p), /^src\/tools\//.test(p)].some(Boolean)) || workflow || dependency;

let mode = 'TARGETED';
if (docsOnly) mode = 'FAST';
if (unknown) mode = 'FULL';
const gates = new Set(['contracts']);
if (localization) gates.add('localization');
if (security) gates.add('security');
if (seo) gates.add('seo');
for (const tool of tools) gates.add(`e2e:${tool}`);
if (mode === 'FULL') gates.add('full-matrix');

const result = {
  schema_version: 2,
  exactSha: process.env.GITHUB_SHA ?? null,
  base,
  mode,
  files: names,
  gates: [...gates].sort(),
  unknown,
  dependency,
  workflow,
};

mkdirSync('diagnostics', { recursive: true });
writeFileSync('diagnostics/change-risk-plan.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\ngates=${JSON.stringify(result.gates)}\n`);
