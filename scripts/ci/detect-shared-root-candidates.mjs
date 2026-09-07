#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
const read = (name, fallback) => {
  const path = resolve(DIR, name);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
};
const memory = read('failure-memory.json', { rootCauses: {} });
const roots = Object.values(memory.rootCauses ?? {}).filter((root) => root.id && root.id !== 'RC-UNKNOWN-001');
const candidates = [];
const intersection = (a = [], b = []) => [...new Set(a)].filter((value) => new Set(b).has(value));
const normalizeToken = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9:_-]+/g, ' ').trim();

for (let i = 0; i < roots.length; i += 1) {
  for (let j = i + 1; j < roots.length; j += 1) {
    const a = roots[i];
    const b = roots[j];
    const files = intersection(a.affectedFiles, b.affectedFiles);
    const checks = intersection((a.affectedChecks ?? []).map((x) => `${x.gate}:${x.label}`), (b.affectedChecks ?? []).map((x) => `${x.gate}:${x.label}`));
    const symptoms = intersection(a.symptoms, b.symptoms);
    const categories = a.category && b.category && a.category === b.category ? [a.category] : [];
    const evidence = files.length * 0.45 + checks.length * 0.25 + symptoms.length * 0.20 + categories.length * 0.10;
    if (evidence < 0.45) continue;
    candidates.push({
      id: `SRC-${[a.id, b.id].sort().join('-')}`,
      roots: [a.id, b.id].sort(),
      confidence: Number(Math.min(0.95, evidence).toFixed(2)),
      basis: {
        sharedFiles: files.slice(0, 30),
        sharedChecks: checks.slice(0, 30),
        sharedSymptoms: symptoms.slice(0, 30),
        sharedCategories: categories,
      },
      classification: evidence >= 0.75 ? 'HIGH' : 'CANDIDATE',
      action: evidence >= 0.75 ? 'INVESTIGATE_SHARED_ROOT_BEFORE_SYMPTOM_PATCHING' : 'COLLECT_MORE_EVIDENCE',
    });
  }
}

const output = {
  schema: 'flixo-shared-root-candidates/v1',
  generatedAt: new Date().toISOString(),
  candidateCount: candidates.length,
  highConfidenceCount: candidates.filter((item) => item.classification === 'HIGH').length,
  candidates,
  operatingRule: 'NO SYMPTOM PATCHING WHEN SHARED ROOT IS DETECTED',
};
writeFileSync(resolve(DIR, 'shared-root-candidates.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`SHARED_ROOT_CANDIDATES=${output.candidateCount}`);
console.log(`HIGH_CONFIDENCE_SHARED_ROOTS=${output.highConfidenceCount}`);
