import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

const rules = [
  { id: 'eslint-unused', pattern: /no-unused-vars|unused .* is defined|defined but never used|@typescript-eslint\/no-unused-vars/i, command: ['npx', ['eslint', '.', '--fix']] },
  { id: 'prettier', pattern: /prettier|formatting|code style/i, command: ['npx', ['prettier', '--write', '.']] },
  { id: 'typescript', pattern: /TS\d+|type error|typescript/i, command: ['npm', ['run', 'typecheck']] },
];

const matched = rules.filter((rule) => rule.pattern.test(log));
if (matched.length === 0) {
  console.log('AUTO_REPAIR_RESULT=NO_SAFE_RULE');
  process.exit(0);
}

// Only mutate files for deterministic formatter/linter repairs. TypeScript is diagnostic-only.
const mutating = matched.filter((rule) => rule.id === 'eslint-unused' || rule.id === 'prettier');
for (const rule of mutating) {
  console.log(`AUTO_REPAIR_RULE=${rule.id}`);
  execFileSync(rule.command[0], rule.command[1], { stdio: 'inherit' });
}

console.log(`AUTO_REPAIR_MATCHES=${matched.map((r) => r.id).join(',')}`);
console.log(`AUTO_REPAIR_MUTATED=${mutating.map((r) => r.id).join(',') || 'none'}`);
