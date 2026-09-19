#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const memoryPath = resolve(ROOT, 'diagnostics/auto-repair/memory.json');
const fail = (message) => {
  console.error(`AUTO_REPAIR_MEMORY_CONTRACT_ERROR=${message}`);
  process.exit(1);
};

if (!existsSync(memoryPath)) fail('memory-missing');
let memory;
try { memory = JSON.parse(readFileSync(memoryPath, 'utf8')); } catch { fail('invalid-json'); }
if (memory?.version !== 7) fail('version-mismatch');
for (const key of ['cases', 'playbooks', 'lessons', 'antiLessons']) if (!Array.isArray(memory[key])) fail(`invalid-${key}`);

const idPattern = /^[a-f0-9]{20}$/u;
const fingerprintPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;
for (const collection of ['lessons', 'antiLessons']) {
  const ids = new Set();
  for (const lesson of memory[collection]) {
    if (!lesson || typeof lesson !== 'object') fail(`${collection}-entry-not-object`);
    if (typeof lesson.id === 'string' && !idPattern.test(lesson.id) && !/^[a-z0-9][a-z0-9._-]{2,100}$/iu.test(lesson.id)) fail(`${collection}-invalid-id`);
    if (lesson.id && ids.has(lesson.id)) fail(`${collection}-duplicate-id:${lesson.id}`);
    if (lesson.id) ids.add(lesson.id);
    if (typeof lesson.fingerprint !== 'string' || !fingerprintPattern.test(lesson.fingerprint)) fail(`${collection}-missing-or-invalid-fingerprint`);
    const summaryLesson = collection === 'lessons' && typeof lesson.lesson === 'string' && typeof lesson.verifiedSha === 'string' && typeof lesson.canonicalRunId === 'string';
    if (summaryLesson) {
      if (!shaPattern.test(lesson.verifiedSha)) fail(`${collection}-invalid-verified-sha`);
      if (!/^\d+$/.test(lesson.canonicalRunId)) fail(`${collection}-invalid-canonical-run-id`);
      continue;
    }
    if (typeof lesson.rootCause !== 'string' || !lesson.rootCause) fail(`${collection}-missing-root-cause`);
    if (typeof lesson.confidence !== 'number' || lesson.confidence < 0 || lesson.confidence > 1) fail(`${collection}-invalid-confidence`);
    if (!Array.isArray(lesson.evidence) || !Array.isArray(lesson.preventionRules)) fail(`${collection}-evidence-shape`);
  }
}

for (const entry of memory.cases) {
  if (!entry?.fingerprint || typeof entry.fingerprint !== 'string') fail('case-missing-fingerprint');
  if (entry.attempts < 0 || entry.successes < 0 || entry.failures < 0) fail('case-negative-count');
  if (entry.successes + entry.failures > entry.attempts) fail(`case-count-invariant:${entry.fingerprint}`);
}

const canonical = JSON.stringify({ ...memory, integrityDigest: undefined });
const digest = createHash('sha256').update(canonical).digest('hex');
console.log('AUTO_REPAIR_MEMORY_CONTRACT=PASS');
console.log(`AUTO_REPAIR_MEMORY_VERSION=${memory.version}`);
console.log(`AUTO_REPAIR_CASES=${memory.cases.length}`);
console.log(`AUTO_REPAIR_LESSONS=${memory.lessons.length}`);
console.log(`AUTO_REPAIR_ANTILESSONS=${memory.antiLessons.length}`);
console.log(`AUTO_REPAIR_MEMORY_DIGEST=${digest}`);
