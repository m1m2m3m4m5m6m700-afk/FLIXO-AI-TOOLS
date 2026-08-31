import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const sha = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
mkdirSync(out, { recursive: true });

const checks = {
  toolchain: [
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['lint', 'npm', ['run', 'lint']],
    ['ci-contract', 'npm', ['run', 'validate:ci-contract']],
  ],
  architecture: [
    ['tool-registry', 'npm', ['run', 'validate:tool-registry']],
    ['tool-manifest', 'npm', ['run', 'validate:tool-manifest']],
    ['router-registry', 'npm', ['run', 'validate:router-registry']],
    ['baseline', 'npm', ['run', 'validate:baseline']],
    ['route-resolver', 'npm', ['run', 'test:route-resolver']],
  ],
  localization: [
    ['i18n-strict', 'npm', ['run', 'verify:i18n', '--', '--strict', '--report']],
    ['locale-integrity', 'npm', ['run', 'validate:locale-integrity']],
    ['locale-navigation', 'npm', ['run', 'validate:locale-navigation']],
    ['home-i18n', 'npm', ['run', 'validate:home-i18n']],
    ['tool-localization', 'npm', ['run', 'test:tool-localization']],
    ['language-quality', 'node', ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-language-quality-strict.mjs']],
  ],
  seo: [
    ['seo', 'npm', ['run', 'validate:seo']],
    ['seo-manifest', 'npm', ['run', 'validate:seo-manifest']],
    ['use-case-seo', 'npm', ['run', 'validate:use-case-seo']],
    ['indexing', 'npm', ['run', 'validate:indexing']],
    ['breadcrumb-seo', 'npm', ['run', 'validate:breadcrumb-seo']],
    ['multilingual-seo', 'node', ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-google-multilingual-seo.mjs']],
  ],
  security: [
    ['upload-boundary', 'npm', ['run', 'test:upload-boundary']],
    ['file-safety', 'node', ['--experimental-strip-types', 'scripts/test-file-safety.mjs']],
  ],
  artifact: [
    ['output-integrity', 'node', ['--experimental-strip-types', 'scripts/test-output-integrity.mjs']],
    ['svg-integrity', 'node', ['--experimental-strip-types', 'scripts/test-svg-integrity.mjs']],
  ],
  runtime: [
    ['g4-runtime', 'npx', ['playwright', 'test', 'tests/localization-runtime.spec.ts', '--project=chromium', '--workers=4', '--retries=0', '--max-failures=25']],
  ],
  browser: [
    ['browser-localization', 'npx', ['playwright', 'test', 'tests/localization-browser-smoke.spec.ts', '--project=chromium', '--workers=4', '--retries=0', '--max-failures=25']],
  ],
  build: [
    ['build', 'npm', ['run', 'build']],
  ],
};

const run = ([id, command, args]) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn(command, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (x) => { stdout += x.toString(); });
  child.stderr.on('data', (x) => { stderr += x.toString(); });
  child.on('close', (code, signal) => resolve({ id, status: code === 0 ? 'PASS' : 'FAIL', code, signal, durationMs: Date.now() - started, stdout: stdout.slice(-12000), stderr: stderr.slice(-12000) }));
});

const sig = (text) => text.replace(/https?:\/\/[^\s]+/gu, '<URL>').replace(/[0-9a-f]{7,40}/giu, '<SHA>').replace(/\b\d+(?:\.\d+)?\b/gu, '<N>').replace(/\s+/gu, ' ').trim().slice(-800);

async function main() {
  const records = await Promise.all(Object.entries(checks).map(async ([suite, items]) => {
    const results = await Promise.all(items.map(run));
    const record = { suite, sha, status: results.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS', results };
    writeFileSync(join(out, `${suite}.json`), JSON.stringify(record, null, 2) + '\n');
    return record;
  }));

  const failures = records.flatMap((r) => r.results.filter((x) => x.status === 'FAIL').map((x) => ({ suite: r.suite, id: x.id, code: x.code, durationMs: x.durationMs, signature: sig(`${x.stderr}\n${x.stdout}`) })));
  const groups = new Map();
  for (const failure of failures) {
    const key = `${failure.id}|${failure.signature}`;
    const group = groups.get(key) ?? { count: 0, affectedSuites: new Set(), example: failure };
    group.count += 1;
    group.affectedSuites.add(failure.suite);
    groups.set(key, group);
  }
  const rootCauses = [...groups.values()].sort((a, b) => b.count - a.count).map((g, i) => ({ rcId: `RC-INV-${String(i + 1).padStart(3, '0')}`, classification: g.example.id.toUpperCase().replace(/[^A-Z0-9]+/gu, '_'), count: g.count, affectedSuites: [...g.affectedSuites], signature: g.example.signature }));
  const report = { schema_version: 1, sha, status: failures.length ? 'FAIL' : 'PASS', generatedAt: new Date().toISOString(), failureCount: failures.length, rootCauseCount: rootCauses.length, suites: records.map((r) => ({ suite: r.suite, status: r.status, failures: r.results.filter((x) => x.status === 'FAIL').map((x) => x.id) })), rootCauses };
  writeFileSync(join(out, 'ultra-investigation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  const report = { schema_version: 1, sha, status: 'FAIL', failureCount: 1, rootCauseCount: 1, rootCauses: [{ rcId: 'RC-INV-000', classification: 'INVESTIGATOR_CRASH', signature: error?.stack ?? String(error) }], generatedAt: new Date().toISOString() };
  writeFileSync(join(out, 'ultra-investigation.json'), JSON.stringify(report, null, 2) + '\n');
  process.exitCode = 2;
});
