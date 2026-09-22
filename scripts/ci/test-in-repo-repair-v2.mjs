import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  loadPolicy,
  buildRcaManifest,
  validateRcaManifest,
  enforceMutationScope,
  generateCounterexamples,
  buildConvergenceDirective,
  finiteInvariantProof,
  buildFalsifierVerdict,
} from './in-repo-repair-v2.mjs';

const policy = loadPolicy();
assert.equal(policy.maxRepairCycles, 3);
assert.equal(policy.searchSpaceStrategy, 'EVIDENCE_BOUNDED');
assert.equal(policy.allowMultiFileMutation, false);
assert.equal(policy.isolationLevel, 'SURGICAL_PATCH');
assert.equal(policy.falsifierMode, 'CONVERGENCE_GUIDED');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-repair-v2-'));
execFileSync('git', ['init', '-q'], { cwd: tmp });
execFileSync('git', ['config', 'user.name', 'repair-v2-test'], { cwd: tmp });
execFileSync('git', ['config', 'user.email', 'repair-v2-test@example.invalid'], { cwd: tmp });
fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'src', 'test.ts'), 'export const value = 1;\n');
execFileSync('git', ['add', '.'], { cwd: tmp });
execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: tmp });
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tmp, encoding: 'utf8' }).trim();
const candidateSha = 'b'.repeat(40);

const diagnosis = {
  rootCause: 'lease-race',
  directFailureSignal: true,
  ambiguity: false,
  causalConfidence: 0.96,
  hypotheses: [
    { id: 'lease-race', score: 0.96, evidenceLines: ['chair lease write collided'] },
    { id: 'stale-state', score: 0.55, evidenceLines: ['state may be stale'] },
    { id: 'io-ordering', score: 0.42, evidenceLines: ['write ordering is relevant'] },
  ],
  location: { file: 'src/test.ts', line: 1, column: 1 },
  repairHypothesis: { violatedInvariant: 'Chair 1 lease transition is exclusive and atomic.' },
  evidenceProfile: { channels: { directLog: true, sourceContext: true }, diversity: 2 },
};

const manifest = buildRcaManifest({
  targetDir: tmp,
  targetSha: sha,
  failureFingerprint: 'a'.repeat(64),
  failureLog: 'chair lease race at src/test.ts:1:1',
  diagnosis,
  plan: { candidates: diagnosis.hypotheses, reasoning: { rootCause: 'lease-race' } },
  selected: { id: 'lease-race', file: 'src/test.ts' },
});
assert.equal(manifest.protocol, 'FLIXO-IN-REPO-REPAIR-V2');
assert.equal(manifest.cycle, 1);
assert.equal(manifest.root_cause_analysis.alternative_hypotheses.length, 3);
assert.equal(manifest.proposed_fix.isolation_level, 'SURGICAL_PATCH');
assert.equal(validateRcaManifest(manifest, { currentSha: sha }).status, 'PASS');
assert.equal(enforceMutationScope({ manifest, changedPaths: ['src/test.ts'] }).status, 'PASS');
assert.throws(
  () => enforceMutationScope({ manifest, changedPaths: ['src/test.ts', 'src/other.ts'] }),
  /MULTI_FILE_SOURCE_MUTATION_FORBIDDEN/
);

const counters = generateCounterexamples({
  manifest,
  patch: 'if (locked && owner) {}',
  changedPaths: ['src/test.ts'],
});
assert(counters.some((item) => item.id === 'CE-DOUBLE-CLAIM'));

const directive = buildConvergenceDirective({ counterexamples: counters });
assert.equal(directive.mode, 'SEARCH_SPACE_REDUCTION');
assert.equal(directive.next_cycle_requires.includes('previous_counterexample_addressed'), true);

const rejectVerdict = buildFalsifierVerdict({
  manifest,
  actualFailures: [{ label: 'fixture', stderr: 'failed edge' }],
  sourceSha: sha,
  targetSha: candidateSha,
  patch: '',
  changedPaths: ['src/test.ts'],
});
assert.equal(rejectVerdict.falsifierVerdict, 'REJECTED_WITH_COUNTER_EXAMPLE');
assert(rejectVerdict.convergence_directive);

const passVerdict = buildFalsifierVerdict({
  manifest,
  actualFailures: [],
  mutantCasesSurvived: 0,
  sourceSha: sha,
  targetSha: candidateSha,
  patch: '',
  changedPaths: ['src/test.ts'],
});
assert.equal(passVerdict.falsifierVerdict, 'PASS_CONFIRMED');
assert.equal(passVerdict.passConfirmed, true);
assert.equal(passVerdict.finiteInvariantProof.status, 'PROVEN');

const proof = finiteInvariantProof({
  manifest,
  sourceSha: sha,
  targetSha: candidateSha,
  changedPaths: ['src/test.ts'],
  patch: '',
  adversarial: passVerdict,
});
assert.equal(proof.status, 'PROVEN');

const guidancePath = path.join(tmp, 'guidance.json');
fs.writeFileSync(guidancePath, JSON.stringify({ convergenceDirective: directive }));
assert.throws(() => buildRcaManifest({
  targetDir: tmp,
  targetSha: sha,
  failureFingerprint: 'b'.repeat(64),
  failureLog: 'failure',
  diagnosis,
  plan: { candidates: diagnosis.hypotheses, reasoning: { rootCause: 'lease-race' } },
  selected: { id: 'lease-race', file: 'src/test.ts' },
  cycle: 2,
}), /PRIOR_COUNTEREXAMPLE_REQUIRED/);

const cycle2Manifest = buildRcaManifest({
  targetDir: tmp,
  targetSha: sha,
  failureFingerprint: 'b'.repeat(64),
  failureLog: 'failure',
  diagnosis,
  plan: { candidates: diagnosis.hypotheses, reasoning: { rootCause: 'lease-race' } },
  selected: { id: 'lease-race', file: 'src/test.ts' },
  cycle: 2,
  convergenceGuidancePath: guidancePath,
});
assert.equal(cycle2Manifest.convergence.prior_counterexample_digest.length, 64);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('IN_REPO_REPAIR_V2_SELF_TEST=PASS');
