import fs from 'node:fs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

const definitions = [
  ['lint', /eslint|no-unused-vars|defined but never used|no-empty/i],
  ['format', /prettier|formatting|code style/i],
  ['typescript', /TS\d+|Type error|typescript/i],
  ['playwright', /playwright|expect\(|page\.|locator\(|timeout.*expect/i],
  ['webkit-render', /webkit|data-render-revision|GPU rendering|waitForGpuRender/i],
  ['certification', /certification|execution graph|FAST.*66|DEEP.*60|certification-engine/i],
  ['build', /production build|vite build|build failed/i],
];

const snippets = (pattern) => log.split(/\r?\n/)
  .filter((line) => pattern.test(line))
  .slice(-8)
  .map((line) => line.trim().slice(0, 500));

const hypotheses = definitions.map(([id, pattern]) => {
  const matches = log.match(new RegExp(pattern.source, `${pattern.flags.includes('i') ? 'i' : ''}g`)) ?? [];
  const lines = snippets(pattern);
  return {
    id,
    signalCount: matches.length,
    evidenceLines: lines,
    score: Math.min(1, (matches.length * 0.2) + (lines.length * 0.15)),
  };
}).filter((item) => item.signalCount > 0).sort((a, b) => b.score - a.score);

const fileLine = log.match(/(?:^|\s)([^\s:]+\.(?:ts|tsx|js|mjs|jsx)):(\d+)(?::(\d+))?/i);
const errorCodes = [...new Set(log.match(/\b(?:TS\d+|[A-Z][A-Z0-9_]*_ERROR)\b/gi) ?? [])];
const testTitles = [...new Set([...log.matchAll(/(?:›|test:|Test:)\s*([^\n]{5,180})/g)].map((m) => m[1].trim()))].slice(-10);

const top = hypotheses[0] ?? { id: 'unknown', score: 0, signalCount: 0, evidenceLines: [] };
const second = hypotheses[1];
const separation = second ? Math.max(0, top.score - second.score) : top.score;
const directFailureSignal = top.evidenceLines.some((line) => /error|failed|failure|exception|expected|received/i.test(line));
const causalConfidence = Math.min(1, top.score + separation * 0.5 + (directFailureSignal ? 0.15 : 0));
const rootCause = top.id;
const signature = [rootCause, errorCodes[0], fileLine?.[1], fileLine?.[2], testTitles[0]]
  .filter(Boolean)
  .join('|') || rootCause;

const evidence = {
  schemaVersion: 2,
  rootCause,
  hypotheses,
  causalConfidence: Number(causalConfidence.toFixed(3)),
  diagnosisQuality: causalConfidence >= 0.75 && directFailureSignal ? 'strong' : causalConfidence >= 0.5 ? 'provisional' : 'weak',
  directFailureSignal,
  ambiguity: Boolean(second && separation < 0.12),
  signature,
  location: fileLine ? { file: fileLine[1], line: Number(fileLine[2]), column: fileLine[3] ? Number(fileLine[3]) : null } : null,
  errorCodes,
  testTitles,
  generatedAt: new Date().toISOString(),
};

console.log(`FLIXO_ROOT_CAUSE=${rootCause}`);
console.log(`FLIXO_DIAGNOSIS_QUALITY=${evidence.diagnosisQuality}`);
console.log(`FLIXO_CAUSAL_CONFIDENCE=${evidence.causalConfidence}`);
console.log(`FLIXO_FAILURE_SIGNATURE=${signature}`);
fs.writeFileSync('/tmp/flixo-root-cause.json', `${JSON.stringify(evidence, null, 2)}\n`);
