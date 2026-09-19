import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isPathAllowed, repairPolicy } from '../auto-repair-policy.mjs';

export const HISTORICAL_ROLLBACK_PROTOCOL = 'FLIXO-REPAIR-ROLLBACK-v1';
export const REPAIR_MARKER = 'FLIXO-REPAIR-MARKER-v1';
export const HISTORY_LIMIT = 30;

function git(targetDir, args, options = {}) {
  return execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
}

function assertSha(value, label) {
  if (!/^[a-f0-9]{40}$/u.test(String(value ?? ''))) throw new Error(`INVALID_${label}_SHA`);
}

function parseMarkerBlock(body, marker) {
  const lines = String(body ?? '').split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) return null;
  const values = {};
  for (const line of lines.slice(markerIndex + 1)) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)=(.*)$/u);
    if (!match) continue;
    values[match[1]] = match[2].trim();
  }
  return values;
}

export function parseRepairCommit(commit) {
  if (!commit?.sha || !commit?.parents?.length || commit.parents.length !== 1) return null;
  const marker = parseMarkerBlock(commit.body, REPAIR_MARKER);
  if (!marker || marker.kind !== 'verified-source-repair') return null;
  if (!/^[a-f0-9]{64}$/u.test(marker.fingerprint ?? '')) return null;
  assertSha(commit.sha, 'COMMIT');
  assertSha(commit.parents[0], 'PARENT');
  assertSha(marker.failedSha, 'FAILED');
  assertSha(marker.baseSha, 'BASE');
  return {
    commitSha: commit.sha,
    parentSha: commit.parents[0],
    fingerprint: marker.fingerprint,
    rule: marker.rule || null,
    failedSha: marker.failedSha,
    baseSha: marker.baseSha,
  };
}

export function parseRevertCommit(commit) {
  const marker = parseMarkerBlock(commit?.body, HISTORICAL_ROLLBACK_PROTOCOL);
  if (!marker || marker.kind !== 'historical-revert') return null;
  if (!/^[a-f0-9]{40}$/u.test(marker.revertedSha ?? '')) return null;
  if (!/^[a-f0-9]{64}$/u.test(marker.fingerprint ?? '')) return null;
  return {
    commitSha: commit.sha,
    revertedSha: marker.revertedSha,
    fingerprint: marker.fingerprint,
  };
}

export function listRepairHistory(targetDir, limit = HISTORY_LIMIT) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || HISTORY_LIMIT, 200));
  const raw = git(targetDir, ['log', '--first-parent', '-n', String(safeLimit), '--format=%H%x00%P%x00%B%x1e']);
  return raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [sha, parents, ...bodyParts] = record.split('\x00');
    return {
      sha,
      parents: parents ? parents.split(/\s+/u).filter(Boolean) : [],
      body: bodyParts.join('\x00'),
    };
  });
}

function priorSuccessfulRepairTargets(memoryCase) {
  return new Set(
    (memoryCase?.outcomes ?? [])
      .filter((item) => item.outcome === 'success')
      .map((item) => item.provenance?.targetSha)
      .filter((value) => /^[a-f0-9]{40}$/u.test(String(value ?? ''))),
  );
}

function isAncestor(targetDir, ancestorSha, descendantSha) {
  try {
    git(targetDir, ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findHistoricalRepairCandidate(targetDir, { fingerprint, currentSha, memoryCase, historyLimit = HISTORY_LIMIT } = {}) {
  if (!/^[a-f0-9]{64}$/u.test(String(fingerprint ?? ''))) return null;
  assertSha(currentSha, 'CURRENT');
  const successfulTargets = priorSuccessfulRepairTargets(memoryCase);
  const revertedRules = new Set(memoryCase?.revertedRules ?? []);
  if (!successfulTargets.size) return null;

  const commits = listRepairHistory(targetDir, historyLimit);
  const reverted = new Set(commits.map(parseRevertCommit).filter(Boolean).map((item) => item.revertedSha));

  for (const commit of commits) {
    const candidate = parseRepairCommit(commit);
    if (!candidate || candidate.fingerprint !== fingerprint) continue;
    if (reverted.has(candidate.commitSha)) continue;
    if (candidate.rule && revertedRules.has(candidate.rule)) continue;
    if (!successfulTargets.has(candidate.baseSha) && !successfulTargets.has(candidate.failedSha)) continue;
    if (!isAncestor(targetDir, candidate.commitSha, currentSha)) continue;
    if (candidate.baseSha !== candidate.parentSha) continue;
    const changedPaths = git(targetDir, ['diff-tree', '--no-commit-id', '--name-only', '-r', candidate.commitSha]).split('\n').map((item) => item.trim()).filter(Boolean);
    if (!changedPaths.length) continue;
    if (changedPaths.length > repairPolicy.maxChangedFiles || changedPaths.some((path) => !isPathAllowed(path))) continue;
    return { ...candidate, changedPaths };
  }
  return null;
}

export function applyHistoricalRepair(targetDir, candidate) {
  if (!candidate?.commitSha) throw new Error('HISTORICAL_REPAIR_CANDIDATE_MISSING');
  const head = git(targetDir, ['rev-parse', 'HEAD']).trim();
  assertSha(head, 'HEAD');
  assertSha(candidate.commitSha, 'REPAIR_COMMIT');
  if (!isAncestor(targetDir, candidate.commitSha, head)) throw new Error('HISTORICAL_REPAIR_NOT_ANCESTOR');
  if (candidate.parentSha === head) throw new Error('HISTORICAL_REPAIR_IS_HEAD');
  const changedPaths = git(targetDir, ['diff-tree', '--no-commit-id', '--name-only', '-r', candidate.commitSha]).split('\n').map((item) => item.trim()).filter(Boolean);
  if (!changedPaths.length) throw new Error('HISTORICAL_REPAIR_EMPTY_DIFF');
  if (changedPaths.length > repairPolicy.maxChangedFiles || changedPaths.some((path) => !isPathAllowed(path))) throw new Error('HISTORICAL_REPAIR_SCOPE_POLICY');
  try {
    execFileSync('git', ['-C', targetDir, 'revert', '--no-commit', '--no-edit', candidate.commitSha], { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`HISTORICAL_REVERT_CONFLICT:${String(error?.message ?? error)}`, { cause: error });
  }
  return { revertedCommit: candidate.commitSha, baseSha: candidate.baseSha, changedPaths };
}

export function historicalRollbackRecord(candidate) {
  return {
    protocol: HISTORICAL_ROLLBACK_PROTOCOL,
    kind: 'historical-revert',
    revertedSha: candidate.commitSha,
    fingerprint: candidate.fingerprint,
    rule: candidate.rule,
    baseSha: candidate.baseSha,
  };
}

if (process.argv[1]?.endsWith('historical-rollback.mjs') && process.env.FLIXO_HISTORICAL_ROLLBACK_SELF_TEST === '1') {
  const dir = fs.mkdtempSync('/tmp/flixo-historical-rollback-');
  const run = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  run(['init', '-q']);
  run(['config', 'user.name', 'test']);
  run(['config', 'user.email', 'test@example.invalid']);
  fs.writeFileSync(`${dir}/target.txt`, 'before\n');
  run(['add', 'target.txt']);
  run(['commit', '-q', '-m', 'base']);
  const baseSha = run(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(`${dir}/target.txt`, 'after\n');
  run(['add', 'target.txt']);
  run(['commit', '-q', '-m', 'fix(auto-repair): verified repair', '-m', [
    REPAIR_MARKER,
    'kind=verified-source-repair',
    `fingerprint=${'a'.repeat(64)}`,
    'rule=deterministic-test-repair',
    `failedSha=${baseSha}`,
    `baseSha=${baseSha}`,
  ].join('\n')]);
  const repairSha = run(['rev-parse', 'HEAD']).trim();
  const candidate = findHistoricalRepairCandidate(dir, {
    fingerprint: 'a'.repeat(64),
    currentSha: repairSha,
    memoryCase: { outcomes: [{ outcome: 'success', provenance: { targetSha: baseSha } }] },
  });
  if (!candidate?.commitSha) throw new Error('SELF_TEST_CANDIDATE_MISSING');
  applyHistoricalRepair(dir, candidate);
  if (fs.readFileSync(`${dir}/target.txt`, 'utf8') !== 'before\n') throw new Error('SELF_TEST_REVERT_FAILED');
  run(['reset', '--hard', repairSha]);
  run(['revert', '--no-commit', '--no-edit', repairSha]);
  run(['commit', '-q', '-m', 'revert(auto-repair): historical rollback', '-m', [
    HISTORICAL_ROLLBACK_PROTOCOL,
    'kind=historical-revert',
    `revertedSha=${repairSha}`,
    `fingerprint=${'a'.repeat(64)}`,
  ].join('\n')]);
  const noCandidate = findHistoricalRepairCandidate(dir, {
    fingerprint: 'a'.repeat(64),
    currentSha: run(['rev-parse', 'HEAD']).trim(),
    memoryCase: { outcomes: [{ outcome: 'success', provenance: { targetSha: baseSha } }] },
  });
  if (noCandidate) throw new Error('SELF_TEST_REVERT_NOT_REMEMBERED');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('HISTORICAL_ROLLBACK_SELF_TEST=PASS');
}
