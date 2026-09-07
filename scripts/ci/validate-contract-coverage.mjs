import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CONTRACT_ID_LIST } from '../../src/lib/contracts/ci-contracts.ts';
import { CI_CONTRACTS } from './contracts/registry.ts';

const cooperationPath = process.env.FLIXO_COOPERATION_MAP || 'artifacts/ci/protocol-cooperation/cooperation-map.json';
const sourceSha = process.env.FLIXO_SOURCE_SHA || process.env.EXACT_SHA || process.env.GITHUB_SHA || null;

const fail = (message) => {
  throw new Error(`Contract coverage validation failed: ${message}`);
};

const registryIds = CI_CONTRACTS.map((contract) => contract.id);
const uniqueRegistryIds = new Set(registryIds);
if (uniqueRegistryIds.size !== registryIds.length) fail('registry contains duplicate contract IDs');
if (registryIds.length === 0) fail('registry is empty');

const modelIds = [...CONTRACT_ID_LIST].sort();
const sortedRegistry = [...registryIds].sort();
if (JSON.stringify(modelIds) !== JSON.stringify(sortedRegistry)) {
  fail(`contract model IDs differ from operational registry IDs: model=${modelIds.join(',')} registry=${sortedRegistry.join(',')}`);
}

const registryById = new Map(CI_CONTRACTS.map((contract) => [contract.id, contract]));
for (const contract of CI_CONTRACTS) {
  if (!contract.evaluator || !contract.outputs?.length || !contract.inputs?.length) fail(`${contract.id} is not operationally complete`);
  for (const dependency of contract.dependencies || []) if (!registryById.has(dependency)) fail(`${contract.id} references unknown dependency ${dependency}`);
}

let cooperation;
try {
  cooperation = JSON.parse(await readFile(cooperationPath, 'utf8'));
} catch (error) {
  fail(`cooperation map is unreadable: ${error instanceof Error ? error.message : String(error)}`);
}

if (cooperation?.schemaVersion !== 1 || cooperation?.protocol !== 'CI protocol cooperation') fail('invalid cooperation map schema/protocol');
const cooperationIds = Array.isArray(cooperation?.contractIds) ? cooperation.contractIds : [];
const sortedCooperation = [...cooperationIds].sort();
if (JSON.stringify(sortedRegistry) !== JSON.stringify(sortedCooperation)) fail('registry IDs differ from cooperation map IDs');

const evaluatorOwners = cooperation?.ownership?.evaluators ?? {};
const outputOwners = cooperation?.ownership?.outputs ?? {};
for (const contract of CI_CONTRACTS) {
  if (evaluatorOwners[contract.evaluator] !== contract.id) fail(`${contract.id} evaluator ownership is not reflected in cooperation map`);
  for (const output of contract.outputs) if (outputOwners[output] !== contract.id) fail(`${contract.id} output ownership is not reflected for ${output}`);
}

const report = {
  schemaVersion: 1,
  protocol: 'CI contract coverage closure',
  sourceSha,
  modelCount: modelIds.length,
  registryCount: registryIds.length,
  cooperationCount: cooperationIds.length,
  modelIds,
  registryIds: sortedRegistry,
  cooperationIds: sortedCooperation,
  uncoveredRegistryIds: sortedRegistry.filter((id) => !sortedCooperation.includes(id)),
  orphanCooperationIds: sortedCooperation.filter((id) => !sortedRegistry.includes(id)),
  evaluatorCoverage: CI_CONTRACTS.map((contract) => ({ id: contract.id, evaluator: contract.evaluator, owner: evaluatorOwners[contract.evaluator] ?? null })),
  outputCoverage: CI_CONTRACTS.flatMap((contract) => contract.outputs.map((output) => ({ output, owner: outputOwners[output] ?? null, contract: contract.id }))),
  result: 'PASS',
};
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await mkdir('artifacts/ci/protocol-cooperation', { recursive: true });
await writeFile('artifacts/ci/protocol-cooperation/contract-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
