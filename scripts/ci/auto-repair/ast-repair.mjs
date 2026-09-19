import path from 'node:path';
import { execFileSync } from 'node:child_process';

function safeRelativeFile(targetDir, candidate) {
  if (!candidate || typeof candidate !== 'string') throw new Error('FORMAT_TARGET_FILE_MISSING');
  const normalized = candidate.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) throw new Error('FORMAT_TARGET_FILE_UNSAFE');
  if (!/\.(?:mjs|cjs|js|ts|tsx|jsx)$/i.test(normalized)) throw new Error('FORMAT_TARGET_FILE_TYPE_UNSAFE');
  const root = path.resolve(targetDir);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('FORMAT_TARGET_FILE_ESCAPE');
  return normalized;
}

export function runAstRepair(targetDir, plan) {
  if (plan?.id === 'eslint-unused') {
    const file = safeRelativeFile(targetDir, plan.file);
    execFileSync('npx', ['eslint', '--fix', '--', file], { cwd: targetDir, stdio: 'inherit' });
    return { applied: true, engine: 'eslint-ast', target: file };
  }
  if (plan?.id === 'prettier-file') {
    const file = safeRelativeFile(targetDir, plan.file);
    execFileSync('npx', ['prettier', '--write', '--', file], { cwd: targetDir, stdio: 'inherit' });
    return { applied: true, engine: 'prettier-deterministic', target: file };
  }
  return { applied: false, reason: 'no-supported-deterministic-rule' };
}
