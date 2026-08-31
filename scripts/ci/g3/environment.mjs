import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const run = async (cmd, args) => { try { const { stdout } = await exec(cmd, args); return stdout.trim(); } catch (e) { return `ERROR: ${e instanceof Error ? e.message : String(e)}`; } };
const required = ['VITE_SITE_URL','VITE_TEST_ORIGIN','VITE_RUNTIME_ORIGIN','GITHUB_SHA'];
const vars = Object.fromEntries(required.map((name) => [name, process.env[name] ?? '']));
const prodForbiddenForTests = /(^|\.)(vercel\.app|vercel\.sh)$/i;
const failures = [];
if (!vars.VITE_SITE_URL) failures.push('VITE_SITE_URL missing');
if (!vars.VITE_TEST_ORIGIN) failures.push('VITE_TEST_ORIGIN missing');
if (!vars.VITE_RUNTIME_ORIGIN) failures.push('VITE_RUNTIME_ORIGIN missing');
try {
  const site = new URL(vars.VITE_SITE_URL);
  if (prodForbiddenForTests.test(site.hostname)) failures.push('Production/preview origin leaked into G3 browser environment');
} catch { failures.push('VITE_SITE_URL is not a valid URL'); }
const report = { gate: 'G3-01/G3-02/G3-03', status: failures.length ? 'FAIL' : 'PASS', class: failures.length ? 'ENVIRONMENT' : null, rootCause: failures.length ? 'ORIGIN_OR_ENVIRONMENT' : null, runtime: { os: `${os.platform()} ${os.release()}`, arch: os.arch(), node: process.version, npm: await run('npm',['--version']), typescript: await run('npx',['tsc','--version']), vite: await run('npx',['vite','--version']), playwright: await run('npx',['playwright','--version']) }, vars: { VITE_SITE_URL: vars.VITE_SITE_URL, VITE_TEST_ORIGIN: vars.VITE_TEST_ORIGIN, VITE_RUNTIME_ORIGIN: vars.VITE_RUNTIME_ORIGIN }, failures };
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/environment.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exit(failures.length ? 1 : 0);
