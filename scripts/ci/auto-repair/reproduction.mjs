import { execFileSync } from 'node:child_process';

export function impactedTests(features) {
  if (features.includes('format')) return [['npm', ['run', 'format:check']]];
  if (features.includes('webkit') || features.includes('playwright')) return [['npm', ['run', 'test:browser']]];
  if (features.includes('typescript')) return [['npm', ['run', 'typecheck']]];
  if (features.includes('lint')) return [['npm', ['run', 'lint']]];
  return [];
}

export function reproduce(targetDir, commands) {
  const results = [];
  for (const [command, args] of commands) {
    try { execFileSync(command, args, { cwd: targetDir, stdio: 'inherit' }); results.push({ command, args, ok: true }); }
    catch (error) { results.push({ command, args, ok: false, code: error?.status ?? 1 }); }
  }
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}
