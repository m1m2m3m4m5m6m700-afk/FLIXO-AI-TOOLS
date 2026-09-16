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

let rootCause = 'unknown';
if (matches.includes('webkit-render')) rootCause = 'webkit-render';
else if (matches.includes('certification')) rootCause = 'certification';
else if (matches.includes('typescript')) rootCause = 'typescript';
else if (matches.includes('playwright')) rootCause = 'playwright';
else if (matches.includes('lint')) rootCause = 'lint';
else if (matches.includes('format')) rootCause = 'format';
else if (matches.includes('build')) rootCause = 'build';

console.log(`FLIXO_ROOT_CAUSE=${rootCause}`);
console.log(`FLIXO_FAILURE_CLASSES=${matches.join(',') || 'unknown'}`);
fs.writeFileSync('/tmp/flixo-root-cause.json', JSON.stringify({ rootCause, matches }, null, 2));
