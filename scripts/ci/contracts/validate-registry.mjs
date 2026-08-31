import { CI_CONTRACTS } from './registry.ts';

const ID_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)+-\d{3}$/;
const REQUIRED_FIELDS = [
  'id', 'version', 'gate', 'name', 'dependencies', 'inputs', 'outputs',
  'evaluator', 'scope', 'severity', 'execution', 'reusable', 'retry',
  'freshness', 'escalation',
];

function fail(message) {
  throw new Error(`CI contract registry INVALID: ${message}`);
}

const ids = new Set();
const byId = new Map(CI_CONTRACTS.map((contract) => [contract.id, contract]));

if (CI_CONTRACTS.length === 0) fail('registry is empty');

for (const contract of CI_CONTRACTS) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in contract)) fail(`${contract.id}: missing ${field}`);
  }
  if (!ID_RE.test(contract.id)) fail(`${contract.id}: invalid immutable ID format`);
  if (ids.has(contract.id)) fail(`duplicate ID ${contract.id}`);
  ids.add(contract.id);
  if (!Number.isInteger(contract.version) || contract.version < 1) fail(`${contract.id}: invalid version`);
  if (!Array.isArray(contract.dependencies)) fail(`${contract.id}: dependencies must be an array`);
  if (new Set(contract.dependencies).size !== contract.dependencies.length) fail(`${contract.id}: duplicate dependency`);
  for (const dependency of contract.dependencies) {
    if (!byId.has(dependency)) fail(`${contract.id}: unknown dependency ${dependency}`);
    if (dependency === contract.id) fail(`${contract.id}: self dependency`);
  }
  if (!Array.isArray(contract.inputs) || !Array.isArray(contract.outputs)) fail(`${contract.id}: inputs/outputs must be arrays`);
  if (typeof contract.escalation?.deep !== 'boolean' || typeof contract.escalation?.full !== 'boolean') {
    fail(`${contract.id}: invalid escalation flags`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(id, stack = []) {
  if (visiting.has(id)) fail(`dependency cycle: ${[...stack, id].join(' -> ')}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of byId.get(id).dependencies) visit(dependency, [...stack, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const id of byId.keys()) visit(id);

console.log(`CI contract registry PASS: ${CI_CONTRACTS.length} contracts, ${visited.size} dependency nodes, no cycles`);
