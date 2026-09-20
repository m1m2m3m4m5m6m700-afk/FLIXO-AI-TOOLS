import { mkdir, writeFile } from 'node:fs/promises';
import { CI_CONTRACTS } from '../contracts/registry.ts';
import { createExecutionPlan } from './planner.ts';
import { resolveCiMode, sha256 } from './context.ts';

const commitSha = process.env.GITHUB_SHA ?? 'LOCAL';
const baseSha = process.env.GITHUB_BASE_SHA ?? commitSha;
const mode = resolveCiMode(process.env.CI_MODE);

const requestedContracts = process.env.CI_REQUESTED_CONTRACTS
  ? process.env.CI_REQUESTED_CONTRACTS.split(',').map((value) => value.trim()).filter(Boolean)
  : CI_CONTRACTS.map((contract) => contract.id);

const contractHash = sha256(JSON.stringify([...CI_CONTRACTS].sort((a, b) => a.id.localeCompare(b.id))));
const plan = createExecutionPlan({ commitSha, baseSha, mode, requestedContracts, contractHash, contracts: CI_CONTRACTS });

await mkdir('artifacts/ci/plan', { recursive: true });
await writeFile('artifacts/ci/plan/execution-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(`Execution plan PASS: ${plan.executionOrder.join(' -> ')}`);
console.log(`planHash=${plan.planHash}`);
