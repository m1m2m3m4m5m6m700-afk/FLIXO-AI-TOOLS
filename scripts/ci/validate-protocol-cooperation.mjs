import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CI_CONTRACTS } from './contracts/registry.ts';
import { dependencyClosure, topologicalOrder, validateDependencyGraph } from './core/graph.ts';

const fail = (message) => {
  throw new Error(`Protocol cooperation validation failed: ${message}`);
};

const sessionGuard = spawnSync(process.execPath, ['scripts/ci/validate-agent-sessions.mjs'], { stdio: 'inherit', env: process.env });
if (sessionGuard.error) fail(`agent session guard failed to start: ${sessionGuard.error.message}`);
if (sessionGuard.status !== 0) fail(`agent session guard failed with exit code ${sessionGuard.status ?? 'unknown'}`);

validateDependencyGraph(CI_CONTRACTS);

const ids = new Set();
const evaluators = new Map();
const outputs = new Map();

for (const contract of CI_CONTRACTS) {
  if (ids.has(contract.id)) fail(`duplicate contract id ${contract.id}`);
  ids.add(contract.id);

  if (!contract.gate) fail(`${contract.id} has no gate owner`);
  if (!contract.evaluator) fail(`${contract.id} has no evaluator`);
  if (contract.inputs.length === 0) fail(`${contract.id} declares no inputs`);
  if (contract.outputs.length === 0) fail(`${contract.id} declares no outputs`);

  if (evaluators.has(contract.evaluator)) {
    const owner = evaluators.get(contract.evaluator);
    if (owner !== contract.id) fail(`evaluator ${contract.evaluator} is shared by ${owner} and ${contract.id}`);
  } else {
    evaluators.set(contract.evaluator, contract.id);
  }

  for (const output of contract.outputs) {
    const owner = outputs.get(output);
    if (owner && owner !== contract.id) fail(`output ${output} has competing owners ${owner} and ${contract.id}`);
    outputs.set(output, contract.id);
  }
}

const order = topologicalOrder(CI_CONTRACTS);
const position = new Map(order.map((id, index) => [id, index]));
for (const contract of CI_CONTRACTS) {
  for (const dependency of contract.dependencies) {
    if (!ids.has(dependency)) fail(`${contract.id} references unknown dependency ${dependency}`);
    if (position.get(dependency) >= position.get(contract.id)) {
      fail(`${contract.id} executes before dependency ${dependency}`);
    }
  }
}

const gates = [...new Set(CI_CONTRACTS.map((contract) => contract.gate))].sort();
const gateRoots = Object.fromEntries(
  gates.map((gate) => [
    gate,
    CI_CONTRACTS.filter((contract) => contract.gate === gate && contract.dependencies.length === 0).map((contract) => contract.id),
  ]),
);

const roots = CI_CONTRACTS.filter((contract) => contract.dependencies.length === 0).map((contract) => contract.id);
const closure = dependencyClosure(CI_CONTRACTS.map((contract) => contract.id), CI_CONTRACTS);
if (closure.length !== CI_CONTRACTS.length) fail(`dependency closure contains ${closure.length}/${CI_CONTRACTS.length} contracts`);

const report = {
  schemaVersion: 1,
  protocol: 'CI protocol cooperation',
  contractCount: CI_CONTRACTS.length,
  gateCount: gates.length,
  gates,
  roots,
  gateRoots,
  executionOrder: order,
  contractIds: CI_CONTRACTS.map((contract) => contract.id).sort(),
  ownership: {
    evaluators: Object.fromEntries([...evaluators.entries()].sort()),
    outputs: Object.fromEntries([...outputs.entries()].sort()),
  },
  invariants: [
    'single contract registry',
    'single evaluator owner per contract evaluator',
    'single producer per declared output',
    'acyclic dependency graph',
    'dependencies execute before dependents',
    'full dependency closure',
    'downstream blocking is derived from dependency outcomes',
    'agent session guard passes before protocol cooperation can pass',
  ],
};

const hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
report.reportHash = hash;

await mkdir('artifacts/ci/protocol-cooperation', { recursive: true });
await writeFile(
  'artifacts/ci/protocol-cooperation/cooperation-map.json',
  JSON.stringify(report, null, 2) + '\n',
);

console.log(`Protocol cooperation PASS: ${CI_CONTRACTS.length} contracts across ${gates.length} gates`);
console.log(`roots=${roots.join(',')}`);
console.log(`plan=${order.join(' -> ')}`);
console.log(`reportHash=${hash}`);
