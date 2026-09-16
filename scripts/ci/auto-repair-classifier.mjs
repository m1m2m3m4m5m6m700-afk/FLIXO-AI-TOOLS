import fs from 'node:fs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

const patterns = [
  ['lint', /eslint|no-unused-vars|defined but never used/i],
  ['format', /prettier|formatting|code style/i],
  ['typescript', /TS\d+|Type error|typescript/i],
  ['playwright', /playwright|expect\(|page\.|locator\(|timeout.*expect/i],
  ['webkit-render', /webkit|data-render-revision|GPU rendering|waitForGpuRender/i],
  ['certification', /certification|execution graph|FAST.*66|DEEP.*60|certification-engine/i],
  ['build', /production build|vite build|build failed/i],
];

const matches = patterns.filter(([, pattern]) => pattern.test(log)).map(([id]) => id);
const priority = ['webkit-render', 'certification', 'typescript', 'playwright', 'lint', 'format', 'build'];
const rootCause = priority.find((id) => matches.includes(id)) ?? 'unknown';

const fileLine = log.match(/(?:^|\s)([^\s:]+\.(?:ts|tsx|js|mjs|jsx)):(\d+)(?::(\d+))?/i);
const errorCode = log.match(/\b(?:TS\d+|[A-Z_]+_ERROR)\b/gi)?.[0] ?? null;
const testTitle = log.match(/(?:›|test:|Test:)\s*([^\n]{5,180})/)?.[1]?.trim() ?? null;
const signature = [rootCause, errorCode, fileLine?.[1], fileLine?.[2], testTitle]
  .filter(Boolean)
  .join('|') || rootCause;

const evidence = {
  rootCause,
  matches,
  signature,
  location: fileLine ? { file: fileLine[1], line: Number(fileLine[2]), column: fileLine[3] ? Number(fileLine[3]) : null } : null,
  errorCode,
  testTitle,
  generatedAt: new Date().toISOString(),
};

console.log(`FLIXO_ROOT_CAUSE=${rootCause}`);
console.log(`FLIXO_FAILURE_CLASSES=${matches.join(',') || 'unknown'}`);
console.log(`FLIXO_FAILURE_SIGNATURE=${signature}`);
fs.writeFileSync('/tmp/flixo-root-cause.json', `${JSON.stringify(evidence, null, 2)}\n`);
