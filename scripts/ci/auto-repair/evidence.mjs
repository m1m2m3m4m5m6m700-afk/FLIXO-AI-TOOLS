import fs from 'node:fs';
import crypto from 'node:crypto';

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function writeEvidence(path, value) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
export function summarizeDiff(diff) {
  const files = [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((m) => m[2]);
  const added = [...diff.matchAll(/^\+(?!\+\+)/gm)].length;
  const removed = [...diff.matchAll(/^-(?!-)/gm)].length;
  return { files: [...new Set(files)], added, removed, lines: added + removed, diffSha256: sha256(diff) };
}

export function mutationAttribution({
  agentIdentity = null,
  taskId = null,
  baselineSHA = null,
  changedFiles = [],
  rcaFingerprint = null,
  hypothesis = null,
  strategy = null,
  targetedTests = [],
  fullTests = [],
  resultingSHA = null,
  outcome = 'unknown',
} = {}) {
  const shaBound = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
  return Object.freeze({
    schemaVersion: 2,
    agentIdentity: agentIdentity ?? null,
    taskId: taskId ?? null,
    baselineSHA: baselineSHA ?? null,
    changedFiles: [...new Set((changedFiles ?? []).map(String))],
    rcaFingerprint: rcaFingerprint ?? null,
    hypothesis: hypothesis ?? null,
    strategy: strategy ?? null,
    targetedTests: Array.isArray(targetedTests) ? [...targetedTests] : [],
    fullTests: Array.isArray(fullTests) ? [...fullTests] : [],
    resultingSHA: resultingSHA ?? null,
    resultingSHAKnown: shaBound(resultingSHA),
    outcome: outcome ?? 'unknown',
    exactShaBound: shaBound(baselineSHA) && shaBound(resultingSHA),
  });
}
