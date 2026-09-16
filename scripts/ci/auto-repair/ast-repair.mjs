import { execFileSync } from 'node:child_process';

export function runAstRepair(targetDir, plan) {
  if (plan?.id !== 'eslint-unused') return { applied: false, reason: 'no-supported-ast-rule' };
  execFileSync('npx', ['eslint', '.', '--fix'], { cwd: targetDir, stdio: 'inherit' });
  return { applied: true, engine: 'eslint-ast' };
}
