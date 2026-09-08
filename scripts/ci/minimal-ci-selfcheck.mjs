#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const plan = read('scripts/ci/test-plan.json');
const registry = read('scripts/ci/assertion-registry.json');
const required = ['.github/workflows/ci.yml','scripts/ci/test-plan.json','scripts/ci/assertion-registry.json','scripts/ci/certify.mjs'];
const missing = required.filter((p) => !fs.existsSync(path.join(root,p)));
if (missing.length) throw new Error(`Missing canonical files: ${missing.join(', ')}`);
const workflows = fs.readdirSync(path.join(root,'.github/workflows')).filter((f) => /\.ya?ml$/.test(f));
const automated = workflows.filter((f) => {
  const text = fs.readFileSync(path.join(root,'.github/workflows',f),'utf8');
  return /\n\s*(push|pull_request):|on:\s*\[/m.test(text);
});
if (automated.some((f) => f !== 'ci.yml')) throw new Error(`Non-canonical automated workflow detected: ${automated.filter((f)=>f!=='ci.yml').join(', ')}`);
const staticCount = plan.gates?.static?.expected;
const buildCount = plan.gates?.build?.expected;
const browserCount = plan.gates?.browser?.expected;
if (staticCount !== 27 || buildCount !== 2 || browserCount !== 3) throw new Error(`Canonical plan drift: ${staticCount}/${buildCount}/${browserCount}`);
const owners = Object.values(registry.assertions ?? {}).map((a) => a.owner).filter(Boolean);
if (new Set(owners).size !== owners.length) throw new Error('Assertion ownership collision');
const head = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log(JSON.stringify({status:'PASS', head, automatedWorkflows:automated, gates:{static:staticCount,build:buildCount,browser:browserCount}, assertionCount:owners.length},null,2));
