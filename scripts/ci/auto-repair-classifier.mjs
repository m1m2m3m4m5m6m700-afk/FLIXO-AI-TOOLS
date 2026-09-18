import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { reasonFailure, verificationStrategy } from './auto-repair/reasoning.mjs';
import { loadMemory, deriveReusableKnowledge } from './auto-repair-learning.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const targetDir = process.env.FLIXO_TARGET_DIR ?? process.cwd();

function ensureFreshScout(target) {
  const preferred = [
    process.env.FLIXO_SCOUT_REPORT,
    '/tmp/flixo-scout-report.json',
    '/tmp/flixo-investigation/code-scout-latest.json',
  ].filter(Boolean).map(String);
  const existing = preferred.find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;
  const investigationDir = '/tmp/flixo-investigation';
  try {
    fs.mkdirSync(investigationDir, { recursive: true });
    execFileSync('node', ['scripts/ci/code-read-only-scout.mjs'], {
      cwd: target,
      env: { ...process.env, INVESTIGATION_DIR: investigationDir },
      stdio: 'pipe',
    });
    const generated = path.join(investigationDir, 'code-scout-latest.json');
    if (fs.existsSync(generated)) return generated;
  } catch {
    return null;
  }
  return null;
}

const scoutPath = ensureFreshScout(targetDir);
const memory = loadMemory();
const reasoning = reasonFailure(log, { targetDir, scoutPath, historical: memory.lessons.map((item) => ({ rootCause: item.rootCause, confidence: item.confidence })) });
const reusableKnowledge = deriveReusableKnowledge(memory, { rootCause: reasoning.rootCause, features: reasoning.features });

const fileLine = log.match(/(?:^|\s)([^\s:]+\.(?:ts|tsx|js|mjs|jsx)):(\d+)(?::(\d+))?/i);
const errorCodes = [...new Set(log.match(/\b(?:TS\d+|[A-Z][A-Z0-9_]*_ERROR)\b/gi) ?? [])];
const testTitles = [...new Set([...log.matchAll(/(?:›|test:|Test:)\s*([^\n]{5,180})/g)].map((m) => m[1].trim()))].slice(-10);
const signature = [
  reasoning.rootCause,
  errorCodes[0],
  fileLine?.[1],
  fileLine?.[2],
  testTitles[0],
].filter(Boolean).join('|') || reasoning.rootCause;

const evidence = {
  ...reasoning,
  schemaVersion: 3,
  hypotheses: reasoning.hypotheses.map((item) => ({
    id: item.id,
    signalCount: item.directMatches,
    evidenceLines: item.evidenceLines,
    score: item.score,
    specificity: item.specificity,
    suppressedBy: item.suppressedBy ?? null,
  })),
  signature,
  location: fileLine ? { file: fileLine[1], line: Number(fileLine[2]), column: fileLine[3] ? Number(fileLine[3]) : null } : null,
  errorCodes,
  testTitles,
  verificationStrategy: verificationStrategy(reasoning.features),
  reusableKnowledge,
  generatedAt: new Date().toISOString(),
};

console.log(`FLIXO_ROOT_CAUSE=${evidence.rootCause}`);
console.log(`FLIXO_DIAGNOSIS_QUALITY=${evidence.diagnosisQuality}`);
console.log(`FLIXO_CAUSAL_CONFIDENCE=${evidence.causalConfidence}`);
console.log(`FLIXO_REASONING_DECISION=${evidence.decision}`);
console.log(`FLIXO_FAILURE_SIGNATURE=${signature}`);
fs.writeFileSync(process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json', `${JSON.stringify(evidence, null, 2)}\n`);
