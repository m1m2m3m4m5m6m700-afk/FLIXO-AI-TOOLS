#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildPatchSynthesisPacket, loadCandidateInputsFromEnv } from './action-patch-synthesis.mjs';
import { simulateRepair } from './action-repair-sandbox.mjs';

const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));
const arg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

export function buildRepairEngineeringPlan({
  taskId,
  fingerprint,
  targetSha,
  candidates = [],
} = {}) {
  if (!taskId || !fingerprint || !exactSha(targetSha)) {
    throw new Error('REPAIR_ENGINEERING_IDENTITY_REQUIRED');
  }

  const synthesis = buildPatchSynthesisPacket({
    taskId,
    fingerprint,
    targetSha,
    candidateInputs: candidates,
  });

  return {
    schemaVersion: 1,
    protocol: 'REPAIR_ENGINEERING_PIPELINE_V1',
    identity: { taskId, failureFingerprint: fingerprint, targetSha },
    pipeline: [
      'PATCH_SYNTHESIS',
      'SANDBOX_SIMULATION',
      'DIFFERENTIAL_VERIFICATION',
      'OWNER_DECISION',
      'CANONICAL_GREEN',
    ],
    synthesis,
    safety: {
      noSourceMutationDuringSimulation: true,
      exactShaRequired: true,
      oneActiveOwner: 'ACTION-REPAIR',
      testsImmutable: true,
      mainImmutable: true,
      canonicalGreenRequired: true,
      noAutomaticGreen: true,
      failClosed: true,
    },
  };
}

export function executeRepairEngineering({
  repoRoot = process.cwd(),
  taskId,
  fingerprint,
  targetSha,
  candidates = [],
} = {}) {
  const plan = buildRepairEngineeringPlan({ taskId, fingerprint, targetSha, candidates });
  const simulations = [];

  for (const candidate of plan.synthesis.candidates) {
    if (!candidate.readyToSimulate) continue;
    try {
      const simulation = simulateRepair({
        repoRoot,
        taskId,
        fingerprint,
        targetSha,
        candidate,
        checks: candidate.predictedChecks,
      });
      simulations.push(simulation);
    } catch (error) {
      simulations.push({
        schemaVersion: 1,
        protocol: 'REPAIR_SANDBOX_SIMULATION_V1',
        status: 'FAIL',
        candidate: { id: candidate.id, strategy: candidate.strategy },
        error: String(error?.message ?? error),
        mutationPerformed: false,
        canonicalGreenRequired: true,
      });
    }
  }

  const passing = simulations.filter((item) => item.status === 'PASS');
  return {
    ...plan,
    simulations,
    selectedCandidate: passing[0]?.candidate?.id ?? null,
    status: passing.length ? 'READY_FOR_OWNER_REVIEW' : 'NO_PROVEN_CANDIDATE',
    mutationPerformed: false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const taskId = arg('task', process.env.FLIXO_TASK_ID);
  const fingerprint = arg('fingerprint', process.env.FLIXO_FAILURE_FINGERPRINT);
  const targetSha = arg('sha', process.env.FLIXO_TARGET_SHA);
  const candidates = loadCandidateInputsFromEnv();
  const result = executeRepairEngineering({
    repoRoot: process.cwd(),
    taskId,
    fingerprint,
    targetSha,
    candidates,
  });
  const output = arg(
    'output',
    process.env.FLIXO_REPAIR_ENGINEERING_OUTPUT ??
      path.resolve(process.cwd(), 'diagnostics/auto-repair/action-vault/repair-engineering/latest.json'),
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    status: result.status,
    protocol: result.protocol,
    candidateCount: result.synthesis.candidateCount,
    passingSimulations: result.simulations.filter((item) => item.status === 'PASS').length,
    output,
  }, null, 2));
}
