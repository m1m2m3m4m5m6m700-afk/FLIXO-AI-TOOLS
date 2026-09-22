#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const target = path.resolve(root, 'scripts/ci/read-only-deep-reasoning.mjs');
const test = path.resolve(root, 'scripts/ci/test-read-only-deep-reasoning.mjs');
const failures = [];
const source = fs.readFileSync(target, 'utf8');
const testSource = fs.readFileSync(test, 'utf8');

for (const marker of [
  "protocol: 'FLIXO-DEEP-READ-ONLY-INFERENCE-v1'",
  'graph:',
  'timeline',
  'hypotheses',
  'falsification',
  'counterfactuals',
  'evidenceDiversity',
  'independentEvidenceSources',
  'requiresIndependentVerification: true',
  'noMutationAuthority: true',
]) {
  if (!source.includes(marker)) failures.push('MISSING_MARKER=' + marker);
}

if (/git\s+(add|commit|push|reset|checkout)|update_file|create_file|delete_file|mergePullRequest|create_pull_request/u.test(source)) {
  failures.push('MUTATION_SURFACE_DETECTED');
}
if (!/exactSha\(executionSha\)/u.test(source)) failures.push('EXACT_SHA_GUARD_MISSING');
if (!source.includes('COUNTERFACTUAL_SUPPORTS_SINGLE_CAUSE')) failures.push('COUNTERFACTUAL_ANALYSIS_MISSING');
if (!source.includes('SURVIVES_CURRENT_FALSIFICATION')) failures.push('FALSIFICATION_RESULT_MISSING');
if (!testSource.includes('INTERNAL_CONTRACT') || !testSource.includes('BLOCKED_EXTERNAL') || !testSource.includes('DOWNSTREAM_FAILURE')) {
  failures.push('CLASS_FIXTURES_MISSING');
}

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 1,
  authority: 'READ_ONLY_DEEP_REASONING_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkedSha: sha,
  failures,
};

fs.mkdirSync(path.resolve(root, 'diagnostics/investigation'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/investigation/deep-reasoning-contract.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
