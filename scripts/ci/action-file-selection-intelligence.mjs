#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (name, fallback = '') => {
  const prefix = '--' + name + '=';
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const now = () => new Date().toISOString();
const shaOk = (value) => /^[a-f0-9]{40}$/u.test(String(value || ''));
const cleanToken = (value) =>
  String(value || '')
    .replace(/^['"\(\[]+|['"\),;:]+$/gu, '')
    .replace(/:(?:\d+)(?::\d+)?$/u, '');
const isFilePath = (value) =>
  /^(?:\.github\/|scripts\/|src\/|tests?\/|test\/|diagnostics\/|docs\/|public\/|packages\/|config\/|vite\.config|tsconfig|package(?:-lock)?\.json)/u.test(value);

export function selectFileScope({
  taskId,
  failureFingerprint,
  targetSha,
  failedRunId,
  trackedFiles,
  changedFiles,
  failureLog
}) {
  if (!taskId || !failureFingerprint || !shaOk(targetSha) || !failedRunId) {
    throw new Error('ACTION_FILE_SELECTION_IDENTITY_REQUIRED');
  }

  const tracked = [...new Set((trackedFiles || []).filter(Boolean))];
  const trackedSet = new Set(tracked);
  const changed = [...new Set((changedFiles || []).filter((file) => trackedSet.has(file)))];
  const log = String(failureLog || '');
  const directMatches = new Set();

  for (const match of log.matchAll(/(?:^|\s|["'\(])([^\s"'\),;:]+(?:\.[a-z0-9_-]+)?)(?::\d+(?::\d+)?)?/giu)) {
    const token = cleanToken(match[1]);
    if (trackedSet.has(token) && isFilePath(token)) directMatches.add(token);
  }

  const domainSignals = [
    [/github actions?|workflow|runner|yaml|yml/iu, '.github/workflows/'],
    [/repair|agent|orchestrat|action vault|bot/iu, 'scripts/ci/'],
    [/security|codeql|secret|permission/iu, '.github/'],
    [/test|playwright|e2e|assert/iu, 'tests/'],
    [/build|vite|bundle|chunk/iu, 'src/'],
    [/typecheck|typescript|ts[0-9]+/iu, 'src/']
  ];

  const candidates = new Map();
  const add = (file, score, reason, evidence) => {
    if (!trackedSet.has(file)) return;
    const current = candidates.get(file) || { file, score: 0, reasons: [], evidence: [] };
    current.score += score;
    if (!current.reasons.includes(reason)) current.reasons.push(reason);
    if (evidence && !current.evidence.includes(evidence)) current.evidence.push(evidence);
    candidates.set(file, current);
  };

  for (const file of directMatches) add(file, 120, 'DIRECT_FAILURE_PATH', 'failure-log');
  for (const file of changed) add(file, 55, 'CURRENT_SHA_CHANGE_SURFACE', 'git-diff-tree');

  for (const file of directMatches) {
    const directory = path.posix.dirname(file);
    for (const sibling of tracked.filter((candidate) =>
      path.posix.dirname(candidate) === directory && candidate !== file
    ).slice(0, 10)) {
      add(sibling, 24, 'SAME_FILE_FAMILY', file);
    }
  }

  for (const [pattern, directory] of domainSignals) {
    if (!pattern.test(log)) continue;
    for (const candidate of tracked.filter((file) => file.startsWith(directory)).slice(0, 12)) {
      add(candidate, 12, 'FAILURE_DOMAIN_FAMILY', directory);
    }
  }

  const ranked = [...candidates.values()].sort((a, b) =>
    b.score - a.score || a.file.localeCompare(b.file)
  );

  if (!ranked.length) throw new Error('ACTION_FILE_SELECTION_NO_EVIDENCE');

  const selected = ranked.slice(0, 12);
  const primary = selected[0];
  const mode = directMatches.size
    ? 'EXACT_PATH_EVIDENCE'
    : changed.length
      ? 'CURRENT_SHA_CHANGE_SURFACE'
      : 'STRUCTURAL_FALLBACK';
  const confidence = directMatches.size ? 'HIGH' : changed.length ? 'MEDIUM' : 'LOW';
  const selectedPaths = new Set(selected.map((item) => item.file));

  return {
    schemaVersion: 1,
    protocol: 'ACTION-FILE-SELECTION-INTELLIGENCE-v1',
    agentId: 'ACTION-HISTORIAN-3',
    role: 'FILE_SELECTION_INTELLIGENCE_AND_FAILURE_HISTORIAN',
    taskId,
    failedRunId,
    targetSha,
    failureFingerprint,
    exactShaBound: true,
    pathOnlyAnalysis: true,
    codeContentRead: false,
    sourceMutationAllowed: false,
    decision: 'SELECTED',
    selectionMode: mode,
    confidence,
    primaryFile: primary.file,
    selectedFiles: selected.map((item, index) => ({
      rank: index + 1,
      path: item.file,
      score: item.score,
      reasons: item.reasons,
      evidence: item.evidence
    })),
    excludedFiles: ranked
      .filter((item) => !selectedPaths.has(item.file))
      .slice(0, 20)
      .map((item) => ({
        file: item.file,
        score: item.score,
        reason: 'OUTSIDE_MINIMAL_SELECTED_FILE_SURFACE'
      })),
    invariants: {
      fileSelectionPrecedesProgramming: true,
      programmerMustNotWidenScopeSilently: true,
      excludedFilesRequireNewEvidence: true,
      fileChoiceIsNotRootCauseProof: true,
      codeReasoningBelongsToActionRepair: true
    },
    uncertainty: {
      unresolvedRootCause: true,
      requiresProgrammerCodeAnalysis: true,
      statement: 'This artifact selects the smallest evidence-backed file surface; it does not infer source-code causality.'
    },
    generatedAt: now()
  };
}

function gitList(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
}

const taskId = String(arg('task')).trim();
const failureFingerprint = String(arg('fingerprint')).trim();
const targetSha = String(arg('sha')).trim();
const failedRunId = String(arg('run-id')).trim();
const logPath = String(arg('log')).trim();
const output = String(arg('output', '/tmp/action-file-selection-decision.json')).trim();

if (import.meta.url === 'file://' + process.argv[1]) {
  if (!logPath || !fs.existsSync(logPath)) throw new Error('ACTION_FILE_SELECTION_FAILURE_LOG_REQUIRED');
  const decision = selectFileScope({
    taskId,
    failureFingerprint,
    targetSha,
    failedRunId,
    trackedFiles: gitList(['ls-files', '-z']),
    changedFiles: gitList(['diff-tree', '--no-commit-id', '--name-only', '-r', targetSha]),
    failureLog: fs.readFileSync(logPath, 'utf8')
  });
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(decision, null, 2) + '\n');
  console.log(JSON.stringify({
    status: 'PASS',
    protocol: decision.protocol,
    agentId: decision.agentId,
    decision: decision.decision,
    selectionMode: decision.selectionMode,
    confidence: decision.confidence,
    primaryFile: decision.primaryFile,
    selectedCount: decision.selectedFiles.length,
    targetSha: decision.targetSha
  }, null, 2));
}
