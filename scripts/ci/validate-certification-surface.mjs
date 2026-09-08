#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const POLICY_PATH = path.join(ROOT, 'scripts', 'ci', 'origin-policy.json');
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const errors = [];

const workflows = fs.readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => path.join(WORKFLOW_DIR, name));

for (const file of workflows) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');

  if (text.includes(policy.testSentinel)) {
    errors.push(`${relative}: certification workflow contains forbidden test sentinel ${policy.testSentinel}`);
  }
  if (text.includes(policy.runtimeOrigin) === false && /(?:ci|matrix|full-matrix)/i.test(relative)) {
    errors.push(`${relative}: canonical certification workflow must explicitly carry runtime origin ${policy.runtimeOrigin}`);
  }
}

const provenanceFiles = [
  'playwright.config.ts',
  'src/config/origin.config.ts',
  ...fs.readdirSync(path.join(ROOT, 'scripts')).filter((name) => /\.(mjs|js|ts)$/i.test(name)).map((name) => path.join('scripts', name)),
];
const sentinelAllowlist = new Set(policy.sentinelAllowlist ?? []);
for (const relative of provenanceFiles) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.includes(policy.testSentinel)) continue;
  if (!sentinelAllowlist.has(relative.replaceAll('\\', '/'))) {
    errors.push(`${relative}: ${policy.testSentinel} is allowed only in explicit unit/contract sentinel contexts`);
  }
}

const matrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'matrix-first.yml'), 'utf8');
const ci = fs.readFileSync(path.join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
const fullMatrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'full-matrix-parallel.yml'), 'utf8');
const fastVerify = fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'fast-verify.mjs'), 'utf8');
const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'impact-dependency-graph.json'), 'utf8'));

if (!/browser:\s*\[chromium, firefox, webkit\]/.test(matrix)) errors.push('Matrix First must own chromium/firefox/webkit');
if ((matrix.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length !== 22) errors.push('Matrix First must retain exactly 22 canonical tool specs');
if (!/Run impact selector/.test(ci) || !/scripts\/ci\/fast-verify\.mjs/.test(ci)) errors.push('CI must delegate impact execution to Fast Verify');
if (/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fastVerify)) errors.push('Fast Verify must not execute Playwright directly');
if (!/browser:\s*\[chromium, firefox, webkit\]/.test(fullMatrix)) errors.push('Full Matrix must retain all three browsers');
if (graph.authority !== 'canonical-impact-dependency-graph') errors.push('Impact graph authority drift');
if (graph.match?.unmappedPolicy !== 'ESCALATE_ALL_STATIC_BUILD') errors.push('Impact graph must fail closed on unmapped changes');

const result = {
  schema_version: 2,
  status: errors.length ? 'FAIL' : 'PASS',
  workflowCount: workflows.length,
  originPolicy: policy,
  checks: {
    forbiddenCertificationOrigin: errors.every((e) => !e.includes('forbidden test sentinel') && !e.includes('certification workflow contains')),
    sentinelAllowlist: errors.every((e) => !e.includes('allowed only in explicit unit/contract sentinel contexts')),
    matrixOwnership: /browser:\s*\[chromium, firefox, webkit\]/.test(matrix),
    matrixToolCount: (matrix.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length,
    fastVerifyNoBrowserExecution: !/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fastVerify),
    fullMatrixOwnership: /browser:\s*\[chromium, firefox, webkit\]/.test(fullMatrix),
    impactGraphAuthority: graph.authority,
    impactGraphUnmappedPolicy: graph.match?.unmappedPolicy,
  },
  errors,
};

fs.mkdirSync(path.join(ROOT, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'certification', 'surface.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
