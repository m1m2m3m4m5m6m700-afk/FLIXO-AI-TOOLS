import { execFileSync } from 'node:child_process';

export function runRegression(targetDir, commands) {
  const results = [];
  for (const [command, args] of commands) {
    try { execFileSync(command, args, { cwd: targetDir, stdio: 'inherit' }); results.push({ command, args, ok: true }); }
    catch (error) { results.push({ command, args, ok: false, code: error?.status ?? 1 }); return { ok: false, results }; }
  }
  return { ok: true, results };
}
