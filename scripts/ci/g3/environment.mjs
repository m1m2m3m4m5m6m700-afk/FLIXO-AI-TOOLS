import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const run = async (cmd, args) => {
  try { const { stdout } = await exec(cmd, args); return stdout.trim(); }
  catch (error) { return `ERROR: ${error instanceof Error ? error.message : String(error)}`; }
};
const vars = {
  SITE_URL: process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? '',
  TEST_ORIGIN: process.env.TEST_ORIGIN ?? process.env.VITE_TEST_ORIGIN ?? '',
  RUNTIME_ORIGIN: process.env.RUNTIME_ORIGIN ?? process.env.VITE_RUNTIME_ORIGIN ?? '',
  NODE_ENV: process.env.NODE_ENV ?? '',
};
const forbiddenProductionHosts = /(^|\.)(vercel\.app|vercel\.sh)$/i;
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const failures = [];
const started = Date.now();
const checks = [];
const add = (gate, ok, detail, className = 'ENVIRONMENT', rootCause = gate) => {
  const record = { gate, status: ok ? 'PASS' : 'FAIL', class: ok ? null : className, rootCause: ok ? null : rootCause, retryable: false, sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown', durationMs: Date.now() - started, command: `environment check ${gate}`, detail };
  checks.push(record);
  if (!ok) failures.push(record);
};

const runtime = { os: `${os.platform()} ${os.release()}`, arch: os.arch(), node: process.version, npm: await run('npm', ['--version']), typescript: await run('npx', ['tsc', '--version']), vite: await run('npx', ['vite', '--version']), playwright: await run('npx', ['playwright', '--version']) };
add('G3-01', true, runtime);
add('G3-02', Boolean(vars.SITE_URL && vars.TEST_ORIGIN && vars.RUNTIME_ORIGIN), 'SITE_URL, TEST_ORIGIN and RUNTIME_ORIGIN are required');

let site, test, runtimeUrl;
try { site = new URL(vars.SITE_URL); } catch {}
try { test = new URL(vars.TEST_ORIGIN); } catch {}
try { runtimeUrl = new URL(vars.RUNTIME_ORIGIN); } catch {}
add('G3-03', Boolean(site) && !forbiddenProductionHosts.test(site.hostname) && !localHosts.has(site.hostname), site ? `canonical production origin=${site.origin}` : 'invalid SITE_URL');
add('G3-03-origin-isolation', Boolean(site && test && runtimeUrl) && site.origin !== test.origin && site.origin !== runtimeUrl.origin, { site: site?.origin ?? null, test: test?.origin ?? null, runtime: runtimeUrl?.origin ?? null });
add('G3-03-test-runtime', Boolean(test && runtimeUrl), { test: test?.origin ?? null, runtime: runtimeUrl?.origin ?? null }, 'ENVIRONMENT', 'TEST_RUNTIME_ORIGIN');
add('G3-03-node-env', vars.NODE_ENV !== 'production', vars.NODE_ENV || '<unset>', 'ENVIRONMENT', 'BROWSER_PRODUCTION_MODE');

const report = { gate: 'G3-01/G3-02/G3-03', status: failures.length ? 'FAIL' : 'PASS', class: failures.length ? 'ENVIRONMENT' : null, rootCause: failures[0]?.rootCause ?? null, runtime, vars, checks, failures };
await fs.mkdir('artifacts/ci/g3', { recursive: true });
for (const check of checks) await fs.writeFile(`artifacts/ci/g3/${check.gate.replaceAll('/', '-')}.json`, JSON.stringify(check, null, 2) + '\n');
await fs.writeFile('artifacts/ci/g3/environment.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
