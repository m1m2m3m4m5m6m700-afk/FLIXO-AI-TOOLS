#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { derivePatchTruth } from './patch-truth-engine.mjs';

const root = process.cwd();
const shaRe = /^[a-f0-9]{40}$/u;
const fpRe = /^[a-f0-9]{64}$/u;
const arg = (name, fallback = '') => {
  const prefix = '--' + name + '=';
  const hit = process.argv.find((v) => v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
};
const digest = (value) => hash(stable(value));
const add = (blockers, condition, code, detail = null) => {
  if (!condition) blockers.push({ code, detail });
};

const targetSha = arg('target-sha', process.env.FLIXO_EXPECTED_TARGET_SHA);
const candidateSha = arg('candidate-sha', process.env.FLIXO_CANDIDATE_SHA);
const fingerprint = arg('fingerprint', process.env.FLIXO_FAILURE_FINGERPRINT);
const runId = arg('run-id', process.env.GITHUB_RUN_ID);
const phase = arg('phase', 'FINAL');
const output = arg('output', '/tmp/flixo-master-repair-governor.json');

if (!shaRe.test(targetSha) || !shaRe.test(candidateSha) || !fpRe.test(fingerprint) || !String(runId).trim()) {
  throw new Error('MASTER_REPAIR_GOVERNOR_IDENTITY_INVALID');
}
if (git(['branch', '--show-current']) !== 'execution') throw new Error('MASTER_REPAIR_GOVERNOR_BRANCH_INVALID');
if (git(['rev-parse', 'HEAD']) !== candidateSha) throw new Error('MASTER_REPAIR_GOVERNOR_CANDIDATE_NOT_HEAD');
if (targetSha === candidateSha) throw new Error('MASTER_REPAIR_GOVERNOR_BASE_EQUALS_CANDIDATE');

const files = {
  evidence: readJson(arg('repair-evidence', '/tmp/flixo-repair-evidence.json')),
  rca: readJson(arg('rca', '/tmp/flixo-rca-manifest.json')),
  rootProof: readJson(arg('root-proof', '/tmp/action-root-cause-proof.json')),
  diagnosis: readJson(arg('diagnosis', '/tmp/flixo-root-cause.json')),
  verifier: readJson(arg('verification', '/tmp/flixo-candidate-verification.json')),
  adversarial: readJson(arg('adversarial', '/tmp/flixo-postpatch-adversarial.json')),
  chair: readJson(arg('chair', '/tmp/flixo-chair1-audit.json')),
  platform: readJson(arg('platform', '/tmp/flixo-platform-publication-receipt.json')),
  replay: readJson(arg('historical-replay', '/tmp/flixo-historical-replay.json')),
  negative: readJson(arg('negative-proof', '/tmp/flixo-negative-proof.json')),
  rollback: readJson(arg('rollback', '/tmp/flixo-rollback-proof.json')),
  canary: readJson(arg('canary', '/tmp/flixo-canary-proof.json')),
};

const blockers = [];
let patchTruth = null;
try {
  patchTruth = derivePatchTruth({ baseSha: targetSha, candidateSha });
} catch (error) {
  blockers.push({ code: 'PATCH_TRUTH_FAILED', detail: String(error?.message ?? error) });
}

add(blockers, files.evidence?.targetSha === targetSha, 'EVIDENCE_TARGET_SHA_MISMATCH');
add(blockers, files.evidence?.fingerprint === fingerprint, 'EVIDENCE_FINGERPRINT_MISMATCH');
add(blockers, files.rca?.target_sha === targetSha, 'RCA_TARGET_SHA_MISMATCH');
add(blockers, files.rootProof?.targetSha === targetSha, 'ROOT_PROOF_TARGET_SHA_MISMATCH');
add(blockers, files.rootProof?.failureFingerprint === fingerprint, 'ROOT_PROOF_FINGERPRINT_MISMATCH');
add(blockers, files.rootProof?.status === 'PROVEN', 'ROOT_PROOF_NOT_PROVEN');
add(blockers, Array.isArray(files.rca?.root_cause_analysis?.alternative_hypotheses) && files.rca.root_cause_analysis.alternative_hypotheses.length >= 3, 'RCA_HYPOTHESES_INCOMPLETE');
add(blockers, files.diagnosis?.authority === 'READ_ONLY_ERROR_INVESTIGATOR', 'INDEPENDENT_DIAGNOSER_IDENTITY_MISSING');
add(blockers, files.diagnosis?.executionSha === targetSha, 'INDEPENDENT_DIAGNOSER_SHA_MISMATCH');
add(blockers, files.verifier?.protocol === 'FLIXO-CANDIDATE-PARALLEL-VERIFICATION-v1', 'INDEPENDENT_VERIFIER_PROTOCOL_MISSING');
add(blockers, files.verifier?.targetSha === candidateSha, 'INDEPENDENT_VERIFIER_SHA_MISMATCH');
add(blockers, files.verifier?.gate?.result === 'PASS', 'INDEPENDENT_VERIFIER_NOT_PASS');
add(blockers, files.verifier?.gate?.targetedRegression === true, 'TARGETED_REGRESSION_MISSING');
add(blockers, files.verifier?.gate?.adversarialNoCounterexample === true, 'ADVERSARIAL_GATE_FAILED');
add(blockers, files.verifier?.earlyAbort === false, 'VERIFIER_EARLY_ABORT');
add(blockers, files.adversarial?.falsifierVerdict === 'PASS_CONFIRMED' || files.adversarial?.passConfirmed === true, 'ADVERSARIAL_NOT_PASS');
add(blockers, files.platform?.status === 'VERIFIED', 'PLATFORM_ATTESTATION_UNTRUSTED');
add(blockers, files.negative?.allRejected === true, 'NEGATIVE_PROOF_INCOMPLETE');
add(blockers, files.rollback?.status === 'PROVEN', 'ROLLBACK_PROOF_MISSING');
add(blockers, files.canary?.status === 'PASS', 'CANARY_PROOF_MISSING');
add(blockers, files.replay?.status === 'PASS' || files.replay?.status === 'NOT_APPLICABLE', 'HISTORICAL_REPLAY_FAILED');

if (patchTruth && files.evidence?.patchSha256) {
  add(blockers, files.evidence.patchSha256 === patchTruth.patchSha256, 'DECLARED_PATCH_DIGEST_MISMATCH');
}
if (patchTruth && Array.isArray(files.evidence?.changedPaths)) {
  add(
    blockers,
    JSON.stringify([...files.evidence.changedPaths].sort()) === JSON.stringify(patchTruth.changedPaths),
    'DECLARED_PATCH_PATHS_MISMATCH'
  );
}

const diagnosisRoot = String(files.diagnosis?.rootCause ?? files.diagnosis?.root_cause ?? '').trim().toLowerCase();
const rcaRoot = String(files.rca?.root_cause_analysis?.primary_cause ?? '').trim().toLowerCase();
add(blockers, Boolean(diagnosisRoot && rcaRoot), 'DUAL_DIAGNOSIS_CONTENT_MISSING');
add(blockers, !diagnosisRoot || !rcaRoot || diagnosisRoot === rcaRoot, 'DUAL_DIAGNOSIS_CONFLICT', { diagnosisRoot, rcaRoot });

const classifyFailure = (log) => {
  const text = String(log ?? '').toLowerCase();
  if (/permission|authorization|protected branch|forbidden/.test(text)) return 'authority';
  if (/sha|stale|supersed|head changed/.test(text)) return 'stale-state';
  if (/race|lock|concurrent|collision/.test(text)) return 'race';
  if (/security|codeql|vulnerability|secret/.test(text)) return 'security';
  if (/timeout|rate limit|runner|network|unavailable/.test(text)) return 'infrastructure';
  if (/test|assert|expect|snapshot/.test(text)) return 'test';
  if (/evidence|artifact|provenance|receipt/.test(text)) return 'evidence';
  return 'code';
};

let failureLog = '';
try { failureLog = fs.readFileSync(process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log', 'utf8'); } catch {}
const failureTaxonomy = classifyFailure(failureLog);

const authorityVotes = [
  { authority: 'INDEPENDENT_VERIFIER', actor: 'INDEPENDENT_VERIFIER', pass: files.verifier?.gate?.result === 'PASS', candidateSha },
  {
    authority: 'ADVERSARIAL_FALSIFIER',
    actor: String(files.adversarial?.actor ?? 'ADVERSARIAL_FALSIFIER'),
    pass: files.verifier?.gate?.adversarialNoCounterexample === true &&
      (files.adversarial?.falsifierVerdict === 'PASS_CONFIRMED' || files.adversarial?.passConfirmed === true),
    candidateSha,
  },
  {
    authority: 'CHAIR_1_AUTHORITY',
    actor: String(files.chair?.reviewerAgent ?? ''),
    pass: files.chair?.decision === 'APPROVED',
    candidateSha,
  },
];

const actorSet = new Set(authorityVotes.map((x) => x.actor).filter(Boolean));
const passedVotes = authorityVotes.filter((x) => x.pass && x.candidateSha === candidateSha);
if (phase === 'FINAL') {
  add(blockers, actorSet.size === 3, 'AUTHORITY_ACTOR_COLLISION', authorityVotes.map((x) => x.actor));
  add(blockers, passedVotes.length >= 2, 'TWO_OF_THREE_AUTHORITY_NOT_REACHED', { passed: passedVotes.length });
  add(blockers, authorityVotes[2].pass === true, 'CHAIR1_AUTHORITY_REQUIRED');
}

const contradiction =
  (files.verifier?.gate?.result === 'PASS' && files.adversarial?.falsifierVerdict === 'REJECTED_WITH_COUNTER_EXAMPLE') ||
  (files.chair?.decision === 'APPROVED' && files.verifier?.gate?.result !== 'PASS') ||
  (files.platform?.status === 'VERIFIED' && files.platform?.mainProtected !== true && !(files.platform?.activeMainRulesets?.length));
add(blockers, !contradiction, 'SELF_CONTRADICTION_DETECTED', {
  verifier: files.verifier?.gate?.result,
  adversarial: files.adversarial?.falsifierVerdict,
  chair: files.chair?.decision,
  platform: files.platform?.status,
});

const freshnessTargets = new Map([
  ['evidence', targetSha],
  ['rca', targetSha],
  ['rootProof', targetSha],
  ['diagnosis', targetSha],
  ['verifier', candidateSha],
  ['adversarial', candidateSha],
  ['chair', candidateSha],
  ['replay', candidateSha],
  ['rollback', candidateSha],
  ['canary', candidateSha],
]);

for (const [name, expectedSha] of freshnessTargets) {
  const value = files[name];
  const generated = Date.parse(String(value?.generatedAt ?? ''));
  add(blockers, Number.isFinite(generated), 'FRESHNESS_TIMESTAMP_MISSING:' + name);
  if (value?.targetSha) add(blockers, value.targetSha === expectedSha, 'FRESHNESS_SHA_MISMATCH:' + name);
}
add(blockers, Number.isFinite(Date.parse(String(files.platform?.generatedAt ?? ''))), 'FRESHNESS_TIMESTAMP_MISSING:platform');
add(blockers, Number.isFinite(Date.parse(String(files.negative?.generatedAt ?? ''))), 'FRESHNESS_TIMESTAMP_MISSING:negative');

const chainItems = [
  ['FAILURE', { fingerprint, targetSha, runId, failureTaxonomy }],
  ['RCA', files.rca],
  ['ROOT_PROOF', files.rootProof],
  ['PATCH_TRUTH', patchTruth],
  ['CANDIDATE', { candidateSha, parentSha: targetSha }],
  ['VERIFIER', files.verifier],
  ['ADVERSARIAL', files.adversarial],
  ['NEGATIVE_PROOF', files.negative],
  ['HISTORICAL_REPLAY', files.replay],
  ['ROLLBACK', files.rollback],
  ['CANARY', files.canary],
  ['PLATFORM', files.platform],
  ['CHAIR', phase === 'FINAL' ? files.chair : null],
];
let previous = 'GENESIS:FLIXO-MASTER-REPAIR-20X';
const chain = chainItems.map(([type, payload], index) => {
  const linkHash = digest({ type, previous, payload });
  const item = { index, type, previous, payloadDigest: digest(payload), linkHash };
  previous = linkHash;
  return item;
});

const receipt = {
  schemaVersion: 1,
  protocol: 'FLIXO-MASTER-REPAIR-GOVERNOR-v1',
  phase,
  authority: 'INDEPENDENT_FAIL_CLOSED_GOVERNOR',
  mutationAuthority: false,
  greenAuthority: false,
  certificationAuthority: false,
  noImplicitTrust: true,
  target: { failureSha: targetSha, candidateSha, currentSha: git(['rev-parse', 'HEAD']), fingerprint, runId, branch: 'execution' },
  failureTaxonomy,
  patchTruth,
  authorities: authorityVotes,
  authorityCount: { distinct: actorSet.size, passed: passedVotes.length, required: 2 },
  contradictionDetected: contradiction,
  proofChain: { chain, chainRootHash: previous },
  blockers,
  status: blockers.length ? 'UNTRUSTED' : (phase === 'PRE_CHAIR' ? 'EVIDENCE_READY_FOR_CHAIR' : 'TRUSTED_FOR_PUBLICATION'),
  publication: blockers.length === 0 && phase === 'FINAL',
  learningPromotion: 'ONLY_AFTER_CANONICAL_GREEN_AND_CERTIFICATION',
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.', { recursive: true });
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, blockerCount: blockers.length, chainRootHash: previous, output }, null, 2));
if (receipt.status === 'UNTRUSTED') process.exitCode = 2;
