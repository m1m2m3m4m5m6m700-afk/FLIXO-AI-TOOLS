import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SHA_RE = /^[a-f0-9]{40}$/iu;
const OPS = new Set(['CREATE', 'UPDATE', 'DELETE']);
const PROTECTED_PREFIXES = [
  '.github/workflows/',
  'scripts/ci/auto-repair/',
];
const PROTECTED_FILES = new Set([
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/repair-protocol.mjs',
  'scripts/ci/repair-control-plane.mjs',
  'scripts/ci/repair-attempt-ledger.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/task-agent.mjs',
]);
function git(cwd, args) { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim(); }
function normalize(p) {
  const value = String(p ?? '').trim().replace(/\\/g, '/').replace(/^\.\//u, '');
  if (!value || value.includes('\0') || path.posix.isAbsolute(value) || value.split('/').includes('..')) throw new Error('PREPARED_CHANGE_PATH_UNSAFE');
  return value;
}
function safePath(root, relative) {
  const rel = normalize(relative);
  const absolute = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  if (absolute !== rootAbs && !absolute.startsWith(rootAbs + path.sep)) throw new Error('PREPARED_CHANGE_PATH_ESCAPE');
  return { rel, absolute };
}
function isProtected(rel) {
  return PROTECTED_FILES.has(rel) || PROTECTED_PREFIXES.some((prefix) => rel.startsWith(prefix))
    || /(^|\/)\.env(?:\.|$)/iu.test(rel)
    || /(^|\/)secrets?(?:\/|$)/iu.test(rel)
    || /\.(?:pem|key|p12|pfx)$/iu.test(rel);
}
function blobSha(file) {
  try { return git(path.dirname(file), ['hash-object', path.basename(file)]); } catch { return null; }
}
function loadPacket(packetPath) {
  const raw = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  if (Array.isArray(raw.preparedChanges)) return raw;
  if (Array.isArray(raw.selected) && raw.selected[0]?.output) {
    return JSON.parse(fs.readFileSync(raw.selected[0].output, 'utf8'));
  }
  return raw;
}
export function extractPreparedChanges(packetPath, targetSha) {
  if (!packetPath || !fs.existsSync(packetPath)) return { ok: false, reason: 'PREPARED_PACKET_MISSING', changes: [] };
  let packet;
  try { packet = loadPacket(packetPath); } catch (error) { return { ok: false, reason: 'PREPARED_PACKET_INVALID:' + String(error?.message ?? error), changes: [] }; }
  const baseline = String(packet.baselineSha ?? packet.task?.baselineSha ?? '');
  if (!SHA_RE.test(baseline) || baseline !== String(targetSha)) return { ok: false, reason: 'PREPARED_PACKET_BASELINE_SHA_MISMATCH', changes: [] };
  if (packet.preparedOnly !== true || packet.mutationPolicy !== 'NO_DIRECT_MUTATION') return { ok: false, reason: 'PREPARED_PACKET_AUTHORITY_INVALID', changes: [] };
  const changes = Array.isArray(packet.preparedChanges) ? packet.preparedChanges : [];
  if (!changes.length) return { ok: false, reason: 'PREPARED_PACKET_EMPTY', changes: [] };
  const normalized = [];
  for (const change of changes) {
    const rel = normalize(change?.path);
    const operation = String(change?.operation ?? '').toUpperCase();
    if (!OPS.has(operation)) return { ok: false, reason: 'PREPARED_CHANGE_OPERATION_INVALID:' + rel, changes: [] };
    if (isProtected(rel)) return { ok: false, reason: 'PREPARED_CHANGE_PROTECTED_PATH:' + rel, changes: [] };
    if (!change?.repairRationale && !change?.reason) return { ok: false, reason: 'PREPARED_CHANGE_RATIONALE_MISSING:' + rel, changes: [] };
    if (!change?.verification) return { ok: false, reason: 'PREPARED_CHANGE_VERIFICATION_MISSING:' + rel, changes: [] };
    const changeSha = String(change?.baselineSha ?? baseline);
    if (changeSha !== baseline) return { ok: false, reason: 'PREPARED_CHANGE_BASELINE_MISMATCH:' + rel, changes: [] };
    normalized.push({ ...change, path: rel, operation, baselineSha: changeSha, repairRationale: String(change.repairRationale ?? change.reason), verification: change.verification });
  }
  const unique = [...new Map(normalized.map((item) => [item.path, item])).values()];
  return { ok: true, reason: 'PREPARED_PACKET_VALID', changes: unique, packet };
}
export function applyPreparedChanges(targetDir, changes, { dryRun = false } = {}) {
  const root = path.resolve(targetDir);
  const affected = [];
  for (const change of changes ?? []) {
    const { rel, absolute } = safePath(root, change.path);
    if (isProtected(rel)) throw new Error('PREPARED_CHANGE_PROTECTED_PATH:' + rel);
    if (change.operation === 'CREATE' && fs.existsSync(absolute)) throw new Error('PREPARED_CHANGE_CREATE_EXISTS:' + rel);
    if ((change.operation === 'UPDATE' || change.operation === 'DELETE') && !fs.existsSync(absolute)) throw new Error('PREPARED_CHANGE_TARGET_MISSING:' + rel);
    if (change.operation !== 'CREATE') {
      const actual = blobSha(absolute);
      if (change.baselineSha && actual && actual !== change.baselineSha) throw new Error('PREPARED_CHANGE_FILE_SHA_MISMATCH:' + rel);
    }
    affected.push(rel);
    if (dryRun) continue;
    if (change.operation === 'DELETE') fs.rmSync(absolute);
    else {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, String(change.content ?? ''));
    }
  }
  return { applied: !dryRun, files: affected };
}
export function preparedPlan(packetPath, targetSha) {
  const parsed = extractPreparedChanges(packetPath, targetSha);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    id: 'prepared-source-change',
    mutate: true,
    confidence: 95,
    targetScope: 'prepared-contract',
    file: parsed.changes[0]?.path ?? null,
    files: parsed.changes.map((item) => item.path),
    preparedChanges: parsed.changes,
    packetDigest: parsed.packet?.digest ?? null,
    deterministicProof: true,
    repairRationale: parsed.changes.map((item) => item.repairRationale),
    verificationPlan: parsed.changes.map((item) => item.verification),
  };
}
