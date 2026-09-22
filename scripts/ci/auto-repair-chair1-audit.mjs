#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CHAIR_DEFINITIONS } from './chair-bound-execution.mjs';

const ROOT = process.cwd();
const SHA_RE = /^[a-f0-9]{40}$/u;
const HASH_RE = /^[a-f0-9]{64}$/u;
const arg = (name, fallback='') => {
  const prefix = '--' + name + '=';
  const token = process.argv.find((value) => value.startsWith(prefix));
  return token ? token.slice(prefix.length) : fallback;
};
const now = () => new Date().toISOString();
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const assertSha = (value, label) => {
  const text = String(value ?? '').trim();
  if (!SHA_RE.test(text)) throw new Error(`CHAIR1_AUDIT_${label}_INVALID`);
  return text;
};
const readJson = (file, label) => {
  if (!file || !fs.existsSync(file)) throw new Error(`CHAIR1_AUDIT_${label}_MISSING`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const writeJson = (file, value) => {
  fs.mkdirSync(requireDir(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const requireDir = (file) => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.';
const normalizePaths = (paths) => [...new Set(paths.map((value) => {
  const normalized = String(value ?? '').trim().replaceAll('\\\\', '/');
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}).filter(Boolean))].sort();

const proposalPath = arg('proposal', '/tmp/flixo-chair1-proposal.json');
const auditPath = arg('output', '/tmp/flixo-chair1-audit.json');
const lessonPath = arg('lesson-output', '/tmp/flixo-chair1-learning.json');
const evidencePath = arg('evidence', '/tmp/flixo-repair-evidence.json');
const verificationPath = arg('verification', '/tmp/flixo-candidate-verification.json');
const adversarialPath = arg('adversarial', '/tmp/flixo-postpatch-adversarial.json');
const candidateSha = assertSha(arg('candidate', git(['rev-parse', 'HEAD'])), 'CANDIDATE_SHA');
const parentSha = assertSha(arg('parent', git(['rev-parse', `${candidateSha}^`])), 'PARENT_SHA');
const currentSha = assertSha(git(['rev-parse', 'HEAD']), 'CURRENT_SHA');

const failures = [];
const checked = [];
const reject = (code, detail) => { failures.push({ code, detail }); };
const requireCondition = (condition, code, detail) => { if (!condition) reject(code, detail); };

const evidence = readJson(evidencePath, 'EVIDENCE');
const verification = readJson(verificationPath, 'VERIFICATION');
const adversarial = readJson(adversarialPath, 'ADVERSARIAL');

const changedPaths = normalizePaths(
  git(['diff', '--name-only', parentSha, candidateSha]).split(/\\r?\\n/u).filter(Boolean)
);
const patch = execFileSync('git', ['diff', '--binary', parentSha, candidateSha], { cwd: ROOT });
const patchSha256 = crypto.createHash('sha256').update(patch).digest('hex');
const repairPaths = normalizePaths(Array.isArray(evidence.changedPaths) ? evidence.changedPaths : []);
const controlPlanePath = /^(?:scripts\/ci\/(?:repair-|auto-repair)|scripts\/ci\/(?:agent-|execution-mutation-gate|control-plane)|\.github\/workflows\/)/u;
const sensitivePath = /(^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$|(^|\/)secrets?\//iu;
const testPath = /(^|\/)(?:tests?|__tests__)(?:\/|$)|(?:^|\/)test-[^/]+\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu;

requireCondition(CHAIR_DEFINITIONS.chair_1.permissions.includes('SOURCE_MUTATION'), 'CHAIR1_SOURCE_MUTATION_PERMISSION_MISSING', 'chair_1 must retain SOURCE_MUTATION authority');
requireCondition(currentSha === candidateSha, 'CANDIDATE_NOT_HEAD', { currentSha, candidateSha });
requireCondition(git(['rev-list', '--parents', '-n', '1', candidateSha]).split(/\s+/u).slice(1).includes(parentSha), 'CANDIDATE_PARENT_MISMATCH', { candidateSha, parentSha });
requireCondition(evidence.protocol === 'AUTONOMOUS-REPAIR-PROTOCOL-v4', 'REPAIR_EVIDENCE_PROTOCOL_INVALID', evidence.protocol);
requireCondition(evidence.targetSha === parentSha, 'REPAIR_TARGET_SHA_MISMATCH', { evidenceSha: evidence.targetSha, parentSha });
requireCondition(['verified-repair', 'verified-historical-revert'].includes(evidence.outcome), 'REPAIR_OUTCOME_NOT_VERIFIED', evidence.outcome);
requireCondition(verification?.mode === 'PARALLEL', 'PARALLEL_VERIFICATION_MISSING', verification?.mode);
requireCondition(verification?.gate?.result === 'PASS', 'TARGETED_ADVERSARIAL_GATE_FAILED', verification?.gate);
requireCondition(verification?.gate?.targetedRegression === true, 'TARGETED_REGRESSION_MISSING', verification?.gate?.targetedRegression);
requireCondition(verification?.gate?.adversarialNoCounterexample === true, 'ADVERSARIAL_COUNTEREXAMPLE_PRESENT', verification?.gate?.adversarialNoCounterexample);
requireCondition(verification?.earlyAbort === false, 'VERIFICATION_EARLY_ABORT', verification?.earlyAbort);
requireCondition(adversarial?.falsifierVerdict ? String(adversarial.falsifierVerdict).includes('PASS') || adversarial.passConfirmed === true : true, 'ADVERSARIAL_EVIDENCE_NOT_PASS', adversarial?.falsifierVerdict ?? null);
requireCondition(Array.isArray(changedPaths) && changedPaths.length > 0, 'EMPTY_CANDIDATE_DIFF', changedPaths);
requireCondition(JSON.stringify(changedPaths) === JSON.stringify(repairPaths.sort()), 'REPAIR_EVIDENCE_CHANGED_PATHS_MISMATCH', { changedPaths, repairPaths });
requireCondition(changedPaths.length <= 12, 'CHANGED_FILES_LIMIT_EXCEEDED', changedPaths.length);
requireCondition(!changedPaths.some((file) => controlPlanePath.test(file)), 'CONTROL_PLANE_MUTATION_REQUIRES_SEPARATE_GOVERNANCE', changedPaths.filter((file) => controlPlanePath.test(file)));
requireCondition(!changedPaths.some((file) => sensitivePath.test(file)), 'SENSITIVE_PATH_MUTATION', changedPaths.filter((file) => sensitivePath.test(file)));
requireCondition(!changedPaths.some((file) => testPath.test(file)), 'TEST_MUTATION_NOT_ALLOWED_FOR_REPAIR_CANDIDATE', changedPaths.filter((file) => testPath.test(file)));
requireCondition(evidence.fingerprint && /^[a-f0-9]+$/iu.test(String(evidence.fingerprint)), 'FAILURE_FINGERPRINT_MISSING', evidence.fingerprint);
requireCondition(arg('actor', 'AUTO_REPAIR_BOT') === 'AUTO_REPAIR_BOT', 'REPAIR_ACTOR_IDENTITY_INVALID', arg('actor'));
requireCondition(arg('required-reviewer', 'chair_1') === 'chair_1', 'REQUIRED_REVIEWER_MUST_BE_CHAIR1', arg('required-reviewer'));

const proposal = {
  schemaVersion: 1,
  protocol: 'FLIXO-AUTO-REPAIR-CHAIR1-AUDIT-v1',
  authority: 'CHAIR_1_STRICT_AUDIT',
  proposerAgent: 'AUTO_REPAIR_BOT',
  requiredReviewerChair: 'chair_1',
  targetSha: parentSha,
  parentSha,
  candidateSha,
  failureFingerprint: String(evidence.fingerprint),
  repairRunId: String(process.env.GITHUB_RUN_ID ?? arg('run-id', '')),
  taskId: arg('task-id', ''),
  workPackageId: arg('work-package', ''),
  changedPaths,
  patchSha256,
  evidenceDigest: sha256(JSON.stringify({
    targetSha: evidence.targetSha,
    outcome: evidence.outcome,
    fingerprint: evidence.fingerprint,
    selected: evidence.selected ?? null,
  })),
  createdAt: now(),
  status: failures.length ? 'REJECTED' : 'READY_FOR_CHAIR_1',
  failures,
};

writeJson(proposalPath, proposal);

const audit = {
  schemaVersion: 1,
  protocol: 'FLIXO-AUTO-REPAIR-CHAIR1-AUDIT-v1',
  chairId: 'chair_1',
  reviewerAuthority: 'CHAIR_1_STRICT_AUDITOR',
  reviewerAgent: 'CHAIR_1_AUDITOR',
  independentFrom: 'AUTO_REPAIR_BOT',
  proposerAgent: 'AUTO_REPAIR_BOT',
  targetSha: parentSha,
  candidateSha,
  parentSha,
  failureFingerprint: String(evidence.fingerprint),
  changedPaths,
  patchSha256,
  decision: failures.length ? 'REJECTED' : 'APPROVED',
  reasonCodes: failures.map((item) => item.code),
  exactSha: currentSha === candidateSha && evidence.targetSha === parentSha,
  adversarialProof: verification?.gate ?? null,
  generatedAt: now(),
};

writeJson(auditPath, audit);

const lesson = {
  schemaVersion: 1,
  protocol: 'FLIXO-AUTO-REPAIR-CHAIR1-TEACHING-v1',
  repairAgent: 'AUTO_REPAIR_BOT',
  targetSha: parentSha,
  candidateSha,
  failureFingerprint: String(evidence.fingerprint),
  type: failures.length ? 'antiLesson' : 'lesson',
  category: failures.length ? 'CHAIR1_REJECTION' : 'CHAIR1_PASSED_AUDIT',
  severity: failures.length ? 'HIGH' : 'INFO',
  rule: failures.length
    ? 'NEVER_PRESENT_A_REPAIR_CHANGE_AS_VERIFIED_UNTIL_CHAIR1_AUDIT_PROVES_EXACT_SHA_DIFF_AND_ADVERSARIAL_EVIDENCE'
    : 'CHAIR1_AUDIT_CONFIRMED_EXACT_SHA_DIFF_AND_ADVERSARIAL_EVIDENCE',
  failures,
  repairWeakness: failures.map((item) => item.code),
  evidence: {
    proposal: proposalPath,
    audit: auditPath,
    verification: verificationPath,
    adversarial: adversarialPath,
  },
  createdAt: now(),
};
writeJson(lessonPath, lesson);

if (failures.length) {
  console.error('CHAIR1_AUDIT=REJECTED');
  console.error(JSON.stringify(audit, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(audit, null, 2));
