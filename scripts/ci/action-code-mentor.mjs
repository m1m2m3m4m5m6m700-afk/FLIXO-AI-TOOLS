#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MENTOR_ID = 'ACTION-CODE-MENTOR';
const PROFILE_PATH = path.join(ROOT, 'diagnostics/auto-repair/action-vault/ACTION-CODE-MENTOR.json');
const PACKET_PATH = path.join(ROOT, 'diagnostics/auto-repair/action-vault/code-mentor/latest-packet.json');
const LESSONS_PATH = path.join(ROOT, 'diagnostics/auto-repair/action-vault/code-mentor/lessons.ndjson');

const arg = (name, fallback = '') => {
  const prefix = '--' + name + '=';
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const readJson = (file, fallback = null) => {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
};
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));
const safePath = (value) => {
  const absolute = path.resolve(ROOT, value);
  if (!absolute.startsWith(ROOT + path.sep)) throw new Error('ACTION_CODE_MENTOR_PATH_OUTSIDE_REPOSITORY');
  return absolute;
};
const dedupe = (items) => [...new Set(items)];

export function validateCodeMentorProfile(profile) {
  const errors = [];
  if (profile?.schemaVersion !== 1) errors.push('MENTOR_SCHEMA_INVALID');
  if (profile?.id !== MENTOR_ID) errors.push('MENTOR_ID_INVALID');
  if (profile?.parentBotId !== 'ACTION-REPAIR') errors.push('MENTOR_PARENT_INVALID');
  if (profile?.authority?.permanentIndependentAuthority !== false) errors.push('MENTOR_INDEPENDENT_AUTHORITY_ENABLED');
  if (profile?.authority?.readOnly !== true) errors.push('MENTOR_NOT_READ_ONLY');
  if (profile?.authority?.canMutateSource !== false) errors.push('MENTOR_SOURCE_MUTATION_ENABLED');
  if (profile?.authority?.canMutateTests !== false) errors.push('MENTOR_TEST_MUTATION_ENABLED');
  if (profile?.authority?.canMutateMain !== false) errors.push('MENTOR_MAIN_MUTATION_ENABLED');
  if (profile?.authority?.canApproveGreen !== false) errors.push('MENTOR_GREEN_AUTHORITY_ENABLED');
  if (profile?.binding?.exactShaRequired !== true) errors.push('MENTOR_EXACT_SHA_MISSING');
  if (profile?.binding?.requiredBeforeMutation !== true) errors.push('MENTOR_PREMUTATION_REQUIREMENT_MISSING');
  if (profile?.teachingModel?.promotionOnlyAfterCanonicalGreen !== true) errors.push('MENTOR_GREEN_PROMOTION_RULE_MISSING');
  if (JSON.stringify(profile?.teachingModel?.learners ?? []) !== JSON.stringify(['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'])) errors.push('MENTOR_LEARNER_SET_INVALID');
  return errors;
}

function classifySource(file, content) {
  const lessons = [];
  const add = (id, category, principle, evidence, practice, antiLesson) => lessons.push({ id, category, principle, evidence, practice, antiLesson });
  if (file.startsWith('.github/workflows/')) {
    if (/continue-on-error\s*:\s*true/u.test(content)) add('CI-001','CI_GUARD','Never hide a required failure with continue-on-error.','workflow contains continue-on-error=true','Keep required jobs fail-closed.','Do not convert a required RED into apparent GREEN.');
    if (/cancel-in-progress\s*:\s*false/u.test(content)) add('CI-002','CI_CONCURRENCY','Review whether stale work can survive after a newer exact SHA arrives.','workflow disables cancellation','Use exact-SHA supersession where the contract requires it.','Do not let stale work certify a newer commit.');
    if (/permissions\s*:/u.test(content)) add('CI-003','CI_SECURITY','Keep workflow permissions explicit and minimal.','workflow declares permissions','Grant only the scopes required by the job.','Do not broaden token permissions merely to make a job pass.');
  }
  if (/execSync\s*\(/u.test(content) || /execFileSync\s*\(/u.test(content)) add('CODE-001','NODE_RUNTIME','Treat shell/process execution as a trust boundary.','Node code invokes a child process','Prefer structured arguments, validated inputs and deterministic exit handling.','Do not interpolate untrusted strings into shell commands.');
  if (/\bany\b/u.test(content)) add('TS-001','TYPESCRIPT','Prefer precise types at repair/control-plane boundaries.','source contains a bare any token','Use unknown plus validation or a narrow interface.','Do not add any simply to silence type errors.');
  if (/catch\s*\{\s*\}/u.test(content)) add('CODE-002','ERROR_HANDLING','An empty catch hides evidence and weakens diagnosis.','empty catch block detected','Record or propagate expected failure with explicit policy.','Do not swallow actionable diagnostics.');
  if (/process\.env\.[A-Z0-9_]+/u.test(content)) add('CODE-003','CONFIGURATION','Environment values need explicit validation at security-sensitive boundaries.','direct process.env access detected','Validate presence, shape and allowed values before use.','Do not assume deployment configuration is valid.');
  if (/git\s+push\s+--force|force:\s*true/u.test(content)) add('GIT-001','GIT_INTEGRITY','Protected repair flows must remain fast-forward and auditable.','force push/ref mutation pattern detected','Use non-force fast-forward updates and exact parent checks.','Never repair by rewriting protected history.');
  return lessons;
}

export function buildMentorPacket({
  taskId,
  fingerprint,
  targetSha,
  failedRunId,
  sourceFiles = [],
  mode = 'TEACH'
} = {}) {
  if (!taskId) throw new Error('ACTION_CODE_MENTOR_TASK_REQUIRED');
  if (!fingerprint) throw new Error('ACTION_CODE_MENTOR_FINGERPRINT_REQUIRED');
  if (!exactSha(targetSha)) throw new Error('ACTION_CODE_MENTOR_EXACT_SHA_REQUIRED');
  if (!failedRunId) throw new Error('ACTION_CODE_MENTOR_RUN_ID_REQUIRED');
  const profile = readJson(PROFILE_PATH, null);
  const profileErrors = validateCodeMentorProfile(profile);
  if (profileErrors.length) throw new Error('ACTION_CODE_MENTOR_PROFILE_INVALID=' + profileErrors.join(','));

  const repairMemory = readJson(path.join(ROOT, 'diagnostics/auto-repair/memory.json'), { lessons: [], antiLessons: [], cases: [] });
  const repairProfile = readJson(path.join(ROOT, 'diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR.json'), { valuableKnowledge: {} });
  const normalizedPaths = dedupe(sourceFiles.filter(Boolean));
  const lessons = [];
  const inspected = [];
  for (const relative of normalizedPaths) {
    const file = safePath(relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const content = fs.readFileSync(file, 'utf8').slice(0, 60000);
    inspected.push({ path: relative, sha256: sha256(content), bytes: Buffer.byteLength(content) });
    lessons.push(...classifySource(relative, content));
  }

  const historical = [
    ...(repairProfile.valuableKnowledge?.provenRules ?? []).map((rule) => ({ source: 'ACTION-REPAIR', rule, kind: 'PROVEN_RULE' })),
    ...(repairProfile.valuableKnowledge?.antiLessons ?? []).map((rule) => ({ source: 'ACTION-REPAIR', rule, kind: 'ANTI_LESSON' })),
    ...(repairMemory.antiLessons ?? []).slice(-20).map((rule) => ({ source: 'REPAIR_MEMORY', rule: typeof rule === 'string' ? rule : JSON.stringify(rule), kind: 'ANTI_LESSON' }))
  ];

  const packet = {
    schemaVersion: 1,
    protocol: 'CODE_MENTOR_PACKET_V1',
    mentorId: MENTOR_ID,
    parentBotId: 'ACTION-REPAIR',
    mode,
    identity: { taskId, fingerprint, targetSha, failedRunId },
    readOnly: true,
    inspected,
    codeLessons: dedupe(lessons.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 50),
    historicalLessons: historical.slice(-50),
    teachingRules: [
      'Teach evidence-backed principles, not authority.',
      'Prefer minimal source changes and targeted regression coverage.',
      'Bind every recommendation to the exact target SHA.',
      'Do not treat a mentor packet as proof of GREEN.'
    ],
    learners: ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'],
    nextAction: 'ACTION-REPAIR_REVIEWS_MENTOR_PACKET',
    createdAt: new Date().toISOString()
  };
  return packet;
}

export function promoteVerifiedMentorPacket(packet, greenRecord) {
  if (!packet?.readOnly || packet?.mentorId !== MENTOR_ID) throw new Error('ACTION_CODE_MENTOR_PACKET_INVALID');
  if (!greenRecord || greenRecord.source !== 'DAILY_FLIXO_GREEN_GATE' || greenRecord.conclusion !== 'success' || greenRecord.zeroRed !== true || greenRecord.exactShaVerified !== true) {
    throw new Error('ACTION_CODE_MENTOR_GREEN_PROOF_REQUIRED');
  }
  if (greenRecord.targetSha !== packet.identity.targetSha || greenRecord.taskId !== packet.identity.taskId || greenRecord.fingerprint !== packet.identity.fingerprint) {
    throw new Error('ACTION_CODE_MENTOR_GREEN_IDENTITY_MISMATCH');
  }
  fs.mkdirSync(path.dirname(LESSONS_PATH), { recursive: true });
  fs.appendFileSync(LESSONS_PATH, JSON.stringify({
    protocol: 'CODE_MENTOR_VERIFIED_LESSON_V1',
    promotedAt: new Date().toISOString(),
    identity: packet.identity,
    codeLessons: packet.codeLessons,
    historicalLessons: packet.historicalLessons,
    greenRecordId: greenRecord.recordId ?? null
  }) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const taskId = arg('task');
  const fingerprint = arg('fingerprint');
  const targetSha = arg('sha');
  const failedRunId = arg('run-id');
  const sourceFiles = arg('paths').split(',').map((x) => x.trim()).filter(Boolean);
  const output = safePath(arg('output', 'diagnostics/auto-repair/action-vault/code-mentor/latest-packet.json'));
  const packet = buildMentorPacket({ taskId, fingerprint, targetSha, failedRunId, sourceFiles, mode: arg('mode', 'TEACH') });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(packet, null, 2) + '\n');
  console.log(JSON.stringify({
    status: 'PASS',
    mentorId: MENTOR_ID,
    parentBotId: 'ACTION-REPAIR',
    codeLessonCount: packet.codeLessons.length,
    historicalLessonCount: packet.historicalLessons.length,
    output
  }, null, 2));
}
