import { chmod, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

let repoRoot;
try {
  repoRoot = runGit(['rev-parse', '--show-toplevel']);
} catch (error) {
  if (process.env.CI) throw new Error(`Git hooks installation requires a Git worktree: ${error instanceof Error ? error.message : String(error)}`);
  console.warn('FLIXO Git hooks: skipped because this directory is not a Git worktree.');
  process.exit(0);
}

const hooksDir = resolve(repoRoot, '.githooks');
await mkdir(hooksDir, { recursive: true });

for (const hook of ['pre-commit', 'pre-push']) {
  await chmod(resolve(hooksDir, hook), 0o755);
}

runGit(['config', 'core.hooksPath', '.githooks']);
console.log(`FLIXO Git hooks installed: core.hooksPath=.githooks (${hooksDir})`);
