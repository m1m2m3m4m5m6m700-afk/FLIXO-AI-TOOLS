#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTROL_PLANE_WORKFLOW_REGISTRY,
  DIRECT_EXECUTION_REF_WRITERS,
} from './control-plane-registry.mjs';

const ROOT = process.cwd();
const WORKFLOW_ROOT = path.join(ROOT, '.github', 'workflows');
const WORKFLOW_EXTENSIONS = new Set(['.yml', '.yaml']);
const failures = [];
const findings = [];

const CAPABILITY_PATTERNS = Object.freeze([
  ['contents:write', /^\s*contents:\s*write\s*$/gimu],
  ['actions:write', /^\s*actions:\s*write\s*$/gimu],
  ['issues:write', /^\s*issues:\s*write\s*$/gimu],
  ['pull-requests:write', /^\s*pull-requests:\s*write\s*$/gimu],
  ['id-token:write', /^\s*id-token:\s*write\s*$/gimu],
]);

const EXECUTION_REF_WRITE_PATTERN =
  /gh\s+api[\s\S]{0,500}?--method\s+(?:POST|PATCH|PUT|DELETE)[\s\S]{0,500}?git\/refs\/heads\/execution/iu;

function workflowFiles() {
  return fs.readdirSync(WORKFLOW_ROOT)
    .filter((name) => WORKFLOW_EXTENSIONS.has(path.extname(name)))
    .sort();
}

function capabilitiesFor(source) {
  const capabilities = new Set();
  for (const [name, pattern] of CAPABILITY_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) capabilities.add(name);
  }
  EXECUTION_REF_WRITE_PATTERN.lastIndex = 0;
  if (EXECUTION_REF_WRITE_PATTERN.test(source)) capabilities.add('execution-ref-write');
  return [...capabilities].sort();
}

for (const file of workflowFiles()) {
  const source = fs.readFileSync(path.join(WORKFLOW_ROOT, file), 'utf8');
  const capabilities = capabilitiesFor(source);
  if (!capabilities.length) continue;
  findings.push({ file, capabilities });

  const registry = CONTROL_PLANE_WORKFLOW_REGISTRY[file];
  if (!registry) {
    failures.push({
      code: 'WORKFLOW_WRITER_UNREGISTERED',
      file,
      capabilities,
    });
    continue;
  }

  const declared = new Set(registry.capabilities || []);
  for (const capability of capabilities) {
    if (!declared.has(capability)) {
      failures.push({
        code: 'WORKFLOW_WRITER_CAPABILITY_UNDECLARED',
        file,
        capability,
        declared: [...declared],
      });
    }
  }

  if (capabilities.includes('execution-ref-write')) {
    if (!DIRECT_EXECUTION_REF_WRITERS.includes(file)) {
      failures.push({
        code: 'EXECUTION_REF_WRITER_NOT_IN_CANONICAL_LANE',
        file,
      });
    }
    if (registry.mutationLane !== 'EXECUTION') {
      failures.push({
        code: 'EXECUTION_REF_WRITER_WRONG_LANE',
        file,
        lane: registry.mutationLane,
      });
    }
    if (registry.mutationGate !== 'scripts/ci/execution-mutation-gate.mjs') {
      failures.push({
        code: 'EXECUTION_REF_WRITER_MISSING_MUTATION_GATE',
        file,
        mutationGate: registry.mutationGate,
      });
    }
    if (registry.directRefMutation !== true) {
      failures.push({
        code: 'EXECUTION_REF_WRITER_DIRECT_FLAG_MISSING',
        file,
      });
    }
  }
}

for (const file of DIRECT_EXECUTION_REF_WRITERS) {
  if (!fs.existsSync(path.join(WORKFLOW_ROOT, file))) {
    failures.push({ code: 'REGISTERED_EXECUTION_WRITER_FILE_MISSING', file });
  }
  if (!CONTROL_PLANE_WORKFLOW_REGISTRY[file]) {
    failures.push({ code: 'REGISTERED_EXECUTION_WRITER_REGISTRY_MISSING', file });
  }
}

const report = Object.freeze({
  protocol: 'FLIXO-CONTROL-PLANE-WRITER-INTEGRITY-v1',
  workflowCount: workflowFiles().length,
  writerWorkflowCount: findings.length,
  findings,
  failures,
  status: failures.length ? 'FAIL' : 'PASS',
});

console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  throw new Error('CONTROL_PLANE_WRITER_INTEGRITY_FAIL=' + JSON.stringify(failures));
}
