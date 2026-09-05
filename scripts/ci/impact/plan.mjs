import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { CI_CONTRACTS } from '../contracts/registry.ts';
import { calculateImpact } from './engine.ts';

const sha = process.env.GITHUB_SHA ?? 'LOCAL';
const base = process.env.GITHUB_BASE_SHA ?? '';
let changedFiles = [];
if (base && sha !== 'LOCAL') {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...${sha}`], { encoding: 'utf8' });
  changedFiles = output.split('\n').map((file) => file.trim()).filter(Boolean);
}

const decision = calculateImpact(changedFiles, CI_CONTRACTS);
const plan = {
  schemaVersion: 1,
  commitSha: sha,
  baseSha: base || sha,
  changedFiles,
  affectedContracts: decision.affectedContracts,
  escalation: decision.escalation,
  reasons: decision.reasons,
  conservative: decision.conservative,
};

await mkdir('artifacts/ci/impact', { recursive: true });
await writeFile('artifacts/ci/impact/impact-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(`Impact plan PASS: escalation=${plan.escalation} affected=${plan.affectedContracts.length}`);
