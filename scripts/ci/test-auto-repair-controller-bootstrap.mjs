#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const controllerRoot = path.resolve(process.env.FLIXO_REPAIR_CONTROLLER ?? '');
const trustedSha = String(process.env.FLIXO_TRUSTED_CONTROLLER_SHA ?? '').trim();

if (!controllerRoot || !fs.existsSync(controllerRoot)) {
  throw new Error('REPAIR_CONTROLLER_BOOTSTRAP_ROOT_MISSING');
}
assert.match(trustedSha, /^[a-f0-9]{40}$/u);

const actualControllerSha = execFileSync('git', ['-C', controllerRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(actualControllerSha, trustedSha, 'trusted controller SHA drifted');

const importController = async (relativePath) =>
  import(pathToFileURL(path.join(controllerRoot, relativePath)).href);

const learning = await importController('scripts/ci/auto-repair-learning.mjs');
const planner = await importController('scripts/ci/auto-repair/planner.mjs');
const errorOnly = await importController('scripts/ci/auto-repair/error-only-programmer.mjs');
const confidence = await importController('scripts/ci/auto-repair/confidence.mjs');

const originalCwd = process.cwd();
process.chdir(controllerRoot);
try {
  const memory = learning.loadMemory();
  assert(Number(memory.version) >= 10, 'trusted controller memory schema is below the supported floor');

  const failureLog =
    'ERROR eslint: no-unused-vars at src/lib/agent/execution-observability.ts:42:3';
  const fingerprintA = learning.fingerprintFailure(failureLog);
  const fingerprintB = learning.fingerprintFailure(failureLog);
  assert.equal(fingerprintA, fingerprintB);

  const diagnosis = {
    rootCause: 'lint',
    decision: 'ALLOW_BOUNDED_MUTATION',
    sourceMutationAllowed: true,
    directFailureSignal: true,
    causalConfidence: 0.92,
    ambiguity: false,
    location: { file: 'src/lib/agent/execution-observability.ts', line: 42, column: 3 },
    failureLog,
  };

  const sourceSelected = {
    id: 'eslint-unused',
    file: 'src/lib/agent/execution-observability.ts',
  };
  const testSelected = {
    id: 'eslint-unused',
    file: 'scripts/ci/test-auto-repair-architecture.mjs',
  };

  const sourceClassification = errorOnly.classifyRepairTarget({ diagnosis, selected: sourceSelected });
  assert.equal(sourceClassification.allowed, true);
  const testClassification = errorOnly.classifyRepairTarget({ diagnosis, selected: testSelected });
  assert.equal(testClassification.allowed, false);
  assert(testClassification.problems.some((item) => item.startsWith('ERROR_REPAIR_TEST_SURFACE_BLOCKED:')));

  const targetSha = actualControllerSha;
  const repairModel = errorOnly.buildErrorOnlyRepairModel({
    log: failureLog,
    diagnosis,
    selected: sourceSelected,
    targetSha,
  });
  assert.equal(repairModel.repair.mutationAllowed, true);

  const plan = planner.planRepair(failureLog, { memory });
  assert.equal(plan.selected?.id, 'eslint-unused');

  const gate = confidence.confidenceGate({
    selected: plan.selected,
    features: plan.features,
  });
  assert.equal(gate.allowed, true);

  console.log(JSON.stringify({
    status: 'PASS',
    protocol: 'AUTO_REPAIR_CONTROLLER_BOOTSTRAP_COMPATIBILITY_v1',
    trustedControllerSha: trustedSha,
    memoryVersion: memory.version,
    sourceRepairAdmission: 'PASS',
    testSurfaceProtection: 'PASS',
    deterministicPlanning: 'PASS',
    mutationGate: 'PASS',
  }));
} finally {
  process.chdir(originalCwd);
}
