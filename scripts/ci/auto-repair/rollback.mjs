import { execFileSync } from 'node:child_process';

export function snapshot(targetDir) {
  return execFileSync('git', ['-C', targetDir, 'diff', '--binary'], { encoding: 'utf8' });
}

export function rollback(targetDir, patch) {
  execFileSync('git', ['-C', targetDir, 'restore', '--staged', '--worktree', '--', '.'], { stdio: 'inherit' });
  if (patch) return false;
  return true;
}
