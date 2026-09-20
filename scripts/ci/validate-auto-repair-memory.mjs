#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { MEMORY_RELATION_TYPES } from './auto-repair-learning.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const memoryPath = resolve(
  ROOT,
  process.env.FLIXO_MEMORY_VALIDATION_PATH
    ?? process.env.FLIXO_TRUSTED_REPAIR_MEMORY
    ?? process.env.FLIXO_REPAIR_MEMORY
    ?? 'diagnostics/auto-repair/memory.json',
);
const fail = (message) => {
  console.error(`AUTO_REPAIR_MEMORY_CONTRACT_ERROR=${message}`);
  process.exit(1);
};

if (!existsSync(memoryPath)) fail('memory-missing');
let memory;
try { memory = JSON.parse(readFileSync(memoryPath, 'utf8')); } catch { fail('invalid-json'); }
if (!Number.isInteger(memory?.version) || memory.version < 9) fail('version-mismatch');
for (const key of ['cases', 'playbooks', 'lessons', 'antiLessons']) if (!Array.isArray(memory[key])) fail(`invalid-${key}`);

const idPattern = /^[a-f0-9]{20}$/u;
for (const collection of ['lessons', 'antiLessons']) {
  const ids = new Set();
  for (const lesson of memory[collection]) {
    if (!lesson || typeof lesson !== 'object') fail(`${collection}-entry-not-object`);
    if (!idPattern.test(String(lesson.id ?? ''))) fail(`${collection}-invalid-id`);
    if (ids.has(lesson.id)) fail(`${collection}-duplicate-id:${lesson.id}`);
    ids.add(lesson.id);
    if (typeof lesson.fingerprint !== 'string' || !lesson.fingerprint) fail(`${collection}-missing-fingerprint`);
    if (typeof lesson.rootCause !== 'string' || !lesson.rootCause) fail(`${collection}-missing-root-cause`);
    if (typeof lesson.confidence !== 'number' || lesson.confidence < 0 || lesson.confidence > 1) fail(`${collection}-invalid-confidence`);
    if (!Array.isArray(lesson.evidence) || !Array.isArray(lesson.preventionRules)) fail(`${collection}-evidence-shape`);
    for (const evidence of lesson.evidence) {
      const provenance = evidence?.provenance;
      if (!provenance || !/^\d+$/.test(String(provenance.runId ?? ''))) fail(`${collection}-missing-provenance-run-id`);
      const hasSha = ['failedSha', 'executionSha', 'targetSha', 'mergedMainSha', 'revertedCommit']
        .some((key) => /^[a-f0-9]{40}$/u.test(String(provenance[key] ?? '')));
      if (!hasSha) fail(`${collection}-missing-provenance-sha`);
    }
  }
}

if (!Array.isArray(memory.actionHistory)) fail('invalid-action-history');

for (const observation of memory.actionHistory) {
  if (!observation || typeof observation !== 'object') fail('action-history-entry-not-object');
  if (!/^[a-f0-9]{64}$/u.test(String(observation.fingerprint ?? ''))) fail('action-history-invalid-fingerprint');
  if (!['success', 'failure'].includes(String(observation.outcome ?? ''))) fail('action-history-invalid-outcome');
  if (Number(observation.successes ?? 0) < 0 || Number(observation.failures ?? 0) < 0) fail('action-history-negative-count');
  if (!Array.isArray(observation.evidence)) fail('action-history-evidence-shape');
  for (const evidence of observation.evidence) {
    if (!evidence || typeof evidence !== 'object') fail('action-history-evidence-not-object');
    if (!/^\d+$/.test(String(evidence.runId ?? ''))) fail('action-history-missing-run-id');
    if (!/^[a-f0-9]{40}$/u.test(String(evidence.headSha ?? ''))) fail('action-history-missing-head-sha');
  }
}

for (const playbook of memory.playbooks) {
  if (!playbook?.rootCause || !playbook?.rule) fail('playbook-missing-identity');
  if ((playbook.attempts ?? 0) < 0 || (playbook.successes ?? 0) < 0 || (playbook.failures ?? 0) < 0) fail('playbook-negative-count');
  if ((playbook.successes ?? 0) + (playbook.failures ?? 0) > (playbook.attempts ?? 0)) fail(`playbook-count-invariant:${playbook.rootCause}:${playbook.rule}`);
  for (const key of ['fingerprints', 'successfulFingerprints', 'failedFingerprints']) {
    if (playbook[key] !== undefined && !Array.isArray(playbook[key])) fail(`playbook-invalid-${key}`);
  }
}

for (const playbook of memory.playbooks) {
  if (!playbook?.rootCause || !playbook?.rule) fail('playbook-missing-identity');
  if ((playbook.attempts ?? 0) < 0 || (playbook.successes ?? 0) < 0 || (playbook.failures ?? 0) < 0) fail('playbook-negative-count');
  if ((playbook.successes ?? 0) + (playbook.failures ?? 0) > (playbook.attempts ?? 0)) fail(`playbook-count-invariant:${playbook.rootCause}:${playbook.rule}`);
  for (const key of ['fingerprints', 'successfulFingerprints', 'failedFingerprints']) {
    if (playbook[key] !== undefined && !Array.isArray(playbook[key])) fail(`playbook-invalid-${key}`);
  }
}

for (const entry of memory.cases) {
  if (!entry?.fingerprint || typeof entry.fingerprint !== 'string') fail('case-missing-fingerprint');
  if (entry.attempts < 0 || entry.successes < 0 || entry.failures < 0) fail('case-negative-count');
  if (entry.successes + entry.failures > entry.attempts) fail(`case-count-invariant:${entry.fingerprint}`);
  if (entry.relations !== undefined) {
    if (!Array.isArray(entry.relations)) fail(`case-relations-invalid:${entry.fingerprint}`);
    for (const relation of entry.relations) {
      if (!relation || !MEMORY_RELATION_TYPES.includes(relation.type) || !relation.target || relation.sourceFingerprint !== entry.fingerprint) fail(`case-relation-invalid:${entry.fingerprint}`);
      if (relation.targetSha && !/^[a-f0-9]{40}$/u.test(String(relation.targetSha))) fail(`case-relation-target-sha-invalid:${entry.fingerprint}`);
      if (relation.sourceSha && !/^[a-f0-9]{40}$/u.test(String(relation.sourceSha))) fail(`case-relation-source-sha-invalid:${entry.fingerprint}`);
    }
  }
  for (const outcome of entry.outcomes ?? []) {
    if (!outcome || typeof outcome !== 'object') fail(`case-outcome-not-object:${entry.fingerprint}`);
    const provenance = outcome.provenance;
    if (!provenance || !/^\d+$/.test(String(provenance.runId ?? ''))) fail(`case-missing-provenance-run-id:${entry.fingerprint}`);
    const hasSha = ['failedSha', 'executionSha', 'targetSha', 'mergedMainSha', 'revertedCommit']
      .some((key) => /^[a-f0-9]{40}$/u.test(String(provenance[key] ?? '')));
    if (!hasSha) fail(`case-missing-provenance-sha:${entry.fingerprint}`);
  }
}

const canonical = JSON.stringify({ ...memory, integrityDigest: undefined });
const digest = createHash('sha256').update(canonical).digest('hex');
console.log('AUTO_REPAIR_MEMORY_CONTRACT=PASS');
console.log(`AUTO_REPAIR_MEMORY_VERSION=${memory.version}`);
console.log(`AUTO_REPAIR_HISTORICAL_REVERTS=${memory.cases.reduce((sum, item) => sum + Number(item.reversions ?? 0), 0)}`);
console.log(`AUTO_REPAIR_CASES=${memory.cases.length}`);
console.log(`AUTO_REPAIR_LESSONS=${memory.lessons.length}`);
console.log(`AUTO_REPAIR_ANTILESSONS=${memory.antiLessons.length}`);
console.log(`AUTO_REPAIR_MEMORY_DIGEST=${digest}`);
