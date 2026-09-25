#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const expectedSha = process.env.EXPECTED_SHA || process.env.GITHUB_SHA;
const runId = process.env.GITHUB_RUN_ID;
const graphPath = path.join(root, 'diagnostics', 'certification', 'execution-graph.json');
const certificationPath = path.join(root, 'diagnostics', 'certification', 'certification.json');
const EXPECTED_FAST_SEMANTIC_UNITS = 69;
const EXPECTED_DEEP_SEMANTIC_LOCALE_BROWSER_UNITS = 60;
const EXPECTED_DEEP_LOCALES = 20;

const fail = (message) => {
  const result = {
    schema_version: 1,
    authority: 'CANONICAL_CERTIFICATION_ENGINE',
    status: 'FAIL',
    exactSha: expectedSha ?? null,
    runId: runId ?? null,
    errors: [message],
  };
  fs.mkdirSync(path.dirname(certificationPath), { recursive: true });
  fs.writeFileSync(certificationPath, `${JSON.stringify(result, null, 2)}\n`);
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
};

if (!expectedSha || !/^[0-9a-f]{40}$/iu.test(expectedSha)) fail('EXPECTED_SHA/GITHUB_SHA is missing or invalid');
if (!runId) fail('GITHUB_RUN_ID is required');
if (!fs.existsSync(graphPath)) fail('execution-graph.json is missing');
const graphValidatorPath = path.join(root, 'scripts', 'ci', 'validate-execution-graph.mjs');
if (!fs.existsSync(graphValidatorPath)) fail('validate-execution-graph.mjs is missing');

const graphValidation = spawnSync(process.execPath, [graphValidatorPath], {
  cwd: root,
  env: { ...process.env, EXPECTED_SHA: expectedSha, GITHUB_RUN_ID: String(runId) },
  encoding: 'utf8',
});
if (graphValidation.error) fail(`execution-graph validator failed to start: ${graphValidation.error.message}`);
if (graphValidation.status !== 0) {
  const diagnostic = String(graphValidation.stderr || graphValidation.stdout || 'unknown validator failure').trim().slice(-1800);
  fail(`execution-graph revalidation failed: ${diagnostic}`);
}

let graph;
try {
  graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
} catch (error) {
  fail(`execution-graph.json is invalid JSON: ${error.message}`);
}

const errors = [];
if (graph.status !== 'PASS') errors.push(`executionGraph.status=${graph.status ?? 'missing'}`);
if (graph.exactSha !== expectedSha) errors.push(`executionGraph.exactSha=${graph.exactSha ?? 'missing'}`);
if (String(graph.runId) !== String(runId)) errors.push(`executionGraph.runId=${graph.runId ?? 'missing'}`);
if (graph.fast?.requiredSemanticUnits !== EXPECTED_FAST_SEMANTIC_UNITS) errors.push(`fast.requiredSemanticUnits=${graph.fast?.requiredSemanticUnits ?? 'missing'}`);
if (graph.fast?.observedSemanticUnits !== EXPECTED_FAST_SEMANTIC_UNITS) errors.push(`fast.observedSemanticUnits=${graph.fast?.observedSemanticUnits ?? 'missing'}`);
if (graph.deep?.expectedSemanticLocaleBrowserUnits !== EXPECTED_DEEP_SEMANTIC_LOCALE_BROWSER_UNITS) errors.push(`deep.expectedSemanticLocaleBrowserUnits=${graph.deep?.expectedSemanticLocaleBrowserUnits ?? 'missing'}`);
if (graph.deep?.semanticLocaleBrowserUnits !== EXPECTED_DEEP_SEMANTIC_LOCALE_BROWSER_UNITS) errors.push(`deep.semanticLocaleBrowserUnits=${graph.deep?.semanticLocaleBrowserUnits ?? 'missing'}`);
if (graph.deep?.expectedLocaleCount !== EXPECTED_DEEP_LOCALES) errors.push(`deep.expectedLocaleCount=${graph.deep?.expectedLocaleCount ?? 'missing'}`);
if (graph.deep?.semanticLocaleCount !== EXPECTED_DEEP_LOCALES) errors.push(`deep.semanticLocaleCount=${graph.deep?.semanticLocaleCount ?? 'missing'}`);
if (graph.conservation?.fast?.status !== 'PASS') errors.push('conservation.fast is not PASS');
if (graph.conservation?.deepSemanticLocaleBrowser?.status !== 'PASS') errors.push('conservation.deepSemanticLocaleBrowser is not PASS');
if (Array.isArray(graph.errors) && graph.errors.length > 0) errors.push(`executionGraph.errors=${graph.errors.length}`);

const evidenceDir = path.dirname(graphPath);
const primaryBrowserEvidence = fs.readdirSync(evidenceDir).filter((name) => /^browser-(?:fast|deep)-(?:chromium|firefox|webkit)-[1-7]\.json$/u.test(name));
if (primaryBrowserEvidence.length !== 27) errors.push(`primaryBrowserEvidence=${primaryBrowserEvidence.length}; expected=27`);

const result = {
  schema_version: 1,
  authority: 'CANONICAL_CERTIFICATION_ENGINE',
  status: errors.length === 0 ? 'PASS' : 'FAIL',
  exactSha: expectedSha,
  runId: String(runId),
  evidence: {
    executionGraph: 'PASS',
    browserArtifacts: primaryBrowserEvidence.length,
    fastSemanticUnits: graph.fast?.observedSemanticUnits ?? 0,
    deepSemanticLocaleBrowserUnits: graph.deep?.semanticLocaleBrowserUnits ?? 0,
    deepLocales: graph.deep?.semanticLocaleCount ?? 0,
  },
  conservation: {
    fast: { required: EXPECTED_FAST_SEMANTIC_UNITS, observed: graph.fast?.observedSemanticUnits ?? 0 },
    deep: { required: EXPECTED_DEEP_SEMANTIC_LOCALE_BROWSER_UNITS, observed: graph.deep?.semanticLocaleBrowserUnits ?? 0 },
  },
  errors,
};

fs.mkdirSync(path.dirname(certificationPath), { recursive: true });
fs.writeFileSync(certificationPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exit(1);
