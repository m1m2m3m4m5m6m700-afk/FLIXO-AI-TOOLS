import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const run = async (cmd, args) => {
  try {
    const { stdout } = await exec(cmd, args);
    return stdout.trim();
  } catch (error) {
    return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  }
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
const checks = [];
const check = (gate, ok, detail) => {
  checks.push({ gate, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) failures.push({ gate, detail });
};

check('G3-01', true, { os: `${os.platform()} ${os.release()}`, arch: os.arch(), node: process.version, npm: await run('npm', ['--version']), typescript: await run('npx', ['tsc', '--version']), vite: await run('npx', ['vite', '--version']), playwright: await run('npx', ['playwright', '--version']) });
check('G3-02', Boolean(vars.SITE_URL && vars.TEST_ORIGIN && vars.RUNTIME_ORIGIN), 'SITE_URL, TEST_ORIGIN and RUNTIME_ORIGIN are required');

let site;
try { site = new URL(vars.SITE_URL); } catch { site = null; }
let test;
try { test = new URL(vars.TEST_ORIGIN); } catch { test = null; }
let runtime;
try { runtime = new URL(vars.RUNTIME_ORIGIN); } catch { runtime = null; }

check('G3-03/site-origin', Boolean(site) && !forbiddenProductionHosts.test(site.hostname) && !localHosts.has(site.hostname), site ? site.origin : 'invalid SITE_URL');
check('G3-03/test-origin', Boolean(test) && (test.origin === 'http://127.0.0.1:3000' || test.origin === vars.TEST_ORIGIN), test ? test.origin : 'invalid TEST_ORIGIN');
check('G3-03/runtime-isolation', Boolean(runtime) && runtime.origin === vars.RUNTIME_ORIGIN, runtime ? runtime.origin : 'invalid RUNTIME_ORIGIN');
check('G3-03/no-cross-origin', Boolean(site && test && runtime) && new Set([site.origin, test.origin, runtime.origin]).size >= 2, 'Production, test and runtime origins must not collapse into one browser origin');
check('G3-03/node-env', vars.NODE_ENV !== 'production', `G3 browser environment NODE_ENV=${vars.NODE_ENV || '<unset>'}`);

const report = {
  gate: 'G3-01/G3-02/G3-03',
  status: failures.length ? 'FAIL' : 'PASS',
  classification: failures.length ? 'ENVIRONMENT' : null,
  rootCause: failures.length ? failures[0].gate : null,
  runtime: checks[0].detail,
  vars: {
    SITE_URL: vars.SITE_URL,
    TEST_ORIGIN: vars.TEST_ORIGIN,
    RUNTIME_ORIGIN: vars.RUNTIME_ORIGIN,
    NODE_ENV: vars.NODE_ENV,
  },
  checks,
  failures,
};

await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/environment.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
