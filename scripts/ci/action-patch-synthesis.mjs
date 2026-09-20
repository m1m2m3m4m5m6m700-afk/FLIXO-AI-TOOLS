#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

const safeRelative = (file) => {
  const normalized = path.normalize(String(file)).replace(/^\.\.(?:[\\/]|$)/u, '');
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(String(file))) {
    throw new Error('PATCH_SYNTHESIS_PATH_OUTSIDE_REPOSITORY');
  }
  return normalized.replaceAll('\\', '/');
};

const protectedPath = (file) =>
  file === '.git' ||
  file.startsWith('.git/') ||
  file.startsWith('node_modules/') ||
  file.startsWith('dist/') ||
  file.startsWith('coverage/') ||
  file.startsWith('tests/') ||
  file.startsWith('__tests__/') ||
  /(^|\/)test[^/]*\.(?:js|jsx|ts|tsx|mjs|cjs)$/u.test(file) ||
  /(?:^|\/).*\.(?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs)$/u.test(file);

const gateWeakening = (file, content) =>
  (/^\.github\/workflows\//u.test(file) || file.startsWith('scripts/ci/')) &&
  /continue-on-error\\s*:\\s*true|continue-on-error\\s*:\\s*\$\\{\\{\\s*true|force\\s*:\\s*true|\\|\\|\\s*true|exit\\s+0\\b/iu.test(content);

export function validatePatchOperation(operation) {
  const file = safeRelative(operation?.path);
  if (protectedPath(file)) throw new Error(`PATCH_SYNTHESIS_PROTECTED_PATH:${file}`);
  const search = String(operation?.search ?? '');
  const replace = String(operation?.replace ?? '');
  if (!search) throw new Error('PATCH_SYNTHESIS_EMPTY_SEARCH');
  if (search === replace) throw new Error('PATCH_SYNTHESIS_NOOP_OPERATION');
  if (search.length > 250_000 || replace.length > 250_000) throw new Error('PATCH_SYNTHESIS_OPERATION_TOO_LARGE');
  if (gateWeakening(file, replace)) throw new Error(`PATCH_SYNTHESIS_GATE_WEAKENING:${file}`);
  return {
    path: file,
    search,
    replace,
    replaceAll: operation?.replaceAll === true,
    rationale: String(operation?.rationale ?? '').slice(0, 2000),
  };
}

export function applyPatchOperations(sourceByPath, operations) {
  const output = new Map(sourceByPath);
  const receipts = [];
  for (const raw of operations) {
    const op = validatePatchOperation(raw);
    if (!output.has(op.path)) throw new Error(`PATCH_SYNTHESIS_FILE_NOT_PRESENT:${op.path}`);
    const before = output.get(op.path);
    const matches = before.split(op.search).length - 1;
    if (matches === 0) throw new Error(`PATCH_SYNTHESIS_ANCHOR_NOT_FOUND:${op.path}`);
    if (!op.replaceAll && matches !== 1) throw new Error(`PATCH_SYNTHESIS_AMBIGUOUS_ANCHOR:${op.path}:${matches}`);
    const after = op.replaceAll ? before.split(op.search).join(op.replace) : before.replace(op.search, op.replace);
    if (after === before) throw new Error(`PATCH_SYNTHESIS_NO_CHANGE:${op.path}`);
    output.set(op.path, after);
    receipts.push({
      path: op.path,
      matches,
      beforeDigest: sha256(before),
      afterDigest: sha256(after),
      rationale: op.rationale,
    });
  }
  return { output, receipts };
}

function normalizeCandidate(candidate, targetSha) {
  const operations = Array.isArray(candidate?.operations) ? candidate.operations.map(validatePatchOperation) : [];
  const checks = [...new Set((candidate?.predictedChecks ?? []).map(String).filter(Boolean))];
  return {
    id: String(candidate?.id ?? sha256(JSON.stringify({operations, checks})).slice(0, 16)),
    source: String(candidate?.source ?? 'PROGRAMMER_SYNTHESIS'),
    strategy: String(candidate?.strategy ?? 'BOUNDED_PATCH'),
    exactSha: String(candidate?.exactSha ?? targetSha),
    confidence: Math.max(0, Math.min(1, Number(candidate?.confidence ?? 0))),
    rationale: String(candidate?.rationale ?? '').slice(0, 4000),
    operations,
    predictedChecks: checks,
    readyToSimulate: operations.length > 0 && exactSha(targetSha),
  };
}

export function buildPatchSynthesisPacket({
  taskId,
  fingerprint,
  targetSha,
  candidateInputs = [],
  maximumCandidates = 8,
} = {}) {
  if (!taskId || !fingerprint || !exactSha(targetSha)) throw new Error('PATCH_SYNTHESIS_IDENTITY_REQUIRED');
  const candidates = [];
  const errors = [];
  for (const input of candidateInputs.slice(0, maximumCandidates)) {
    try {
      const candidate = normalizeCandidate(input, targetSha);
      if (candidate.exactSha !== targetSha) throw new Error('PATCH_SYNTHESIS_STALE_SHA');
      candidates.push(candidate);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }
  candidates.sort((a, b) => Number(b.confidence) - Number(a.confidence));
  return {
    schemaVersion: 1,
    protocol: 'BOUNDED_PATCH_SYNTHESIS_V1',
    identity: { taskId, failureFingerprint: fingerprint, targetSha },
    mutationAuthority: 'ACTION-REPAIR_ONLY',
    candidateCount: candidates.length,
    candidates,
    errors,
    safety: {
      sourceOnly: true,
      testsImmutable: true,
      mainImmutable: true,
      exactShaRequired: true,
      anchorMustBeUnique: true,
      gateWeakeningRejected: true,
      canonicalGreenRequired: true,
      synthesisIsNotProof: true,
      noMutationPerformed: true,
    },
    digest: sha256(taskId + '|' + fingerprint + '|' + targetSha + '|' + JSON.stringify(candidates)),
  };
}

export function loadCandidateInputsFromEnv(name = 'FLIXO_REPAIR_CANDIDATES') {
  const raw = process.env[name];
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('PATCH_SYNTHESIS_ENV_NOT_ARRAY');
  return parsed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const taskId = process.env.FLIXO_TASK_ID ?? '';
  const fingerprint = process.env.FLIXO_FAILURE_FINGERPRINT ?? '';
  const targetSha = process.env.FLIXO_TARGET_SHA ?? '';
  const packet = buildPatchSynthesisPacket({
    taskId,
    fingerprint,
    targetSha,
    candidateInputs: loadCandidateInputsFromEnv(),
  });
  const output = process.env.FLIXO_PATCH_SYNTHESIS_OUTPUT ?? path.join(ROOT, 'diagnostics/auto-repair/action-vault/repair-engineering/patch-synthesis.json');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(packet, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', protocol: packet.protocol, candidateCount: packet.candidateCount, output }, null, 2));
}
