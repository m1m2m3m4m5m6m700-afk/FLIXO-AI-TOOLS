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
const certificationWorkflowSet = new Set(policy.workflowCertificationAllowlist ?? []);

for (const file of workflows) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  if (certificationWorkflowSet.has(relative)) {
    if (text.includes(policy.testSentinel)) errors.push(`${relative}: canonical certification workflow contains forbidden test sentinel ${policy.testSentinel}`);
    if (!text.includes(policy.runtimeOrigin)) errors.push(`${relative}: canonical certification workflow must explicitly use runtime origin ${policy.runtimeOrigin}`);
  }
}

const provenanceFiles = ['playwright.config.ts', 'src/config/origin.config.ts'];
const scriptFiles = fs.readdirSync(path.join(ROOT, 'scripts')).filter((name) => /\.(mjs|js|ts)$/i.test(name)).map((name) => path.join('scripts', name));
const sentinelAllowlist = new Set(policy.sentinelAllowlist ?? []);
const diagnosticAllowlist = new Set(policy.nonCertificationDiagnosticAllowlist ?? []);
for (const relative of [...provenanceFiles, ...scriptFiles]) {
  const normalized = relative.replaceAll('\\', '/');
  if (diagnosticAllowlist.has(normalized)) continue;
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.includes(policy.testSentinel)) continue;
  if (!sentinelAllowlist.has(normalized)) errors.push(`${normalized}: ${policy.testSentinel} is allowed only in explicit unit/contract sentinel contexts`);
}

for (const relative of diagnosticAllowlist) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.includes(policy.testSentinel)) errors.push(`${relative}: diagnostic origin sentinel declaration drift`);
  for (const workflow of workflows) {
    const workflowRelative = path.relative(ROOT, workflow).replaceAll('\\', '/');
    if (!certificationWorkflowSet.has(workflowRelative)) continue;
    if (fs.readFileSync(workflow, 'utf8').includes(relative)) errors.push(`${relative}: non-certification diagnostic must not be invoked by canonical workflow ${workflowRelative}`);
  }
}

const ci = fs.readFileSync(path.join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
const matrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'matrix-first.yml'), 'utf8');
const fullMatrix = fs.readFileSync(path.join(WORKFLOW_DIR, 'full-matrix-parallel.yml'), 'utf8');
const authorityWorkflow = fs.readFileSync(path.join(WORKFLOW_DIR, 'certification-authority.yml'), 'utf8');
const fastVerify = fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'fast-verify.mjs'), 'utf8');
const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'impact-dependency-graph.json'), 'utf8'));

if (!/name:\s*FLIXO Test System/.test(ci)) errors.push('canonical workflow name drift');
if (!/\n\s+static:\s*\n/.test(ci)) errors.push('static engine missing');
if (!/\n\s+build:\s*\n/.test(ci)) errors.push('build engine missing');
if (!/\n\s+browser-fast:\s*\n/.test(ci)) errors.push('browser FAST engine missing');
if (!/\n\s+browser-deep:\s*\n/.test(ci)) errors.push('browser DEEP engine missing');
if (!/\n\s+certify:\s*\n/.test(ci)) errors.push('single certification gate missing');
if (!/browser:\s*\[chromium, firefox, webkit\]/.test(ci)) errors.push('browser engine must own chromium/firefox/webkit');
if ((ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length !== 22) errors.push('FAST browser engine must retain exactly 22 canonical tool specs');
if (!/tests\/localization-runtime\.spec\.ts/.test(ci)) errors.push('DEEP browser engine must retain localization runtime coverage');
if (!/github\.event_name\s*!==\s*'pull_request'/.test(ci)) errors.push('DEEP browser engine must be main/release only');
if (!/flixo-head-sha\.txt/.test(ci) || !/flixo-package-lock\.sha256/.test(ci)) errors.push('immutable build identity missing');
if (!/download-artifact@v6[\s\S]{0,400}flixo-build-/.test(ci)) errors.push('browser must consume canonical build artifact');
if (/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fastVerify)) errors.push('Fast Verify must not execute browser tests');
if (!/role:\s*'ORCHESTRATOR_ONLY'/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'ultra-fast.mjs'), 'utf8'))) errors.push('Ultra must remain orchestrator-only');
if (graph.authority !== 'canonical-impact-dependency-graph') errors.push('Impact graph authority drift');
if (graph.match?.unmappedPolicy !== 'ESCALATE_ALL_STATIC_BUILD') errors.push('Impact graph must fail closed on unmapped changes');

if (/on:\s*\n\s+push:|on:\s*\n\s+pull_request:/s.test(matrix)) errors.push('retired Matrix First workflow must not auto-trigger');
if (/on:\s*\n\s+push:|on:\s*\n\s+pull_request:/s.test(fullMatrix)) errors.push('retired Full Matrix workflow must not auto-trigger');
if (/on:\s*\n\s+push:|on:\s*\n\s+pull_request:/s.test(authorityWorkflow)) errors.push('retired Certification Authority must not auto-trigger');

const result = {
  schema_version: 5,
  status: errors.length ? 'FAIL' : 'PASS',
  workflowCount: workflows.length,
  originPolicy: policy,
  architecture: {
    automaticWorkflow: '.github/workflows/ci.yml',
    engines: ['static', 'build', 'browser-fast', 'browser-deep', 'certify'],
    browserFast: { tools: 22, browsers: 3, units: 66 },
    browserDeep: { locales: 20, browsers: 3 },
    certification: 'single fail-closed certify job',
  },
  checks: {
    automaticWorkflow: certificationWorkflowSet.has('.github/workflows/ci.yml'),
    staticEngine: /\n\s+static:\s*\n/.test(ci),
    buildEngine: /\n\s+build:\s*\n/.test(ci),
    browserFastEngine: /\n\s+browser-fast:\s*\n/.test(ci),
    browserDeepEngine: /\n\s+browser-deep:\s*\n/.test(ci),
    certificationGate: /\n\s+certify:\s*\n/.test(ci),
    fastToolCount: (ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length,
    fastBrowserCount: /browser:\s*\[chromium, firefox, webkit\]/.test(ci),
    deepLocaleOwner: /tests\/localization-runtime\.spec\.ts/.test(ci),
    immutableArtifact: /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci),
    fastVerifyNoBrowserExecution: !/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fastVerify),
    impactGraphAuthority: graph.authority,
  },
  errors,
};

fs.mkdirSync(path.join(ROOT, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'certification', 'surface.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
