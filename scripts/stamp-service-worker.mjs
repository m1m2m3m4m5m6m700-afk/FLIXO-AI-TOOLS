import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const file = new URL('../public/sw.js', import.meta.url);
let commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { commit = 'dev'; }
}
if (!/^[0-9a-f]{7,64}$/iu.test(commit) && commit !== 'dev') throw new Error(`Invalid build commit identity: ${commit}`);
const source = await readFile(file, 'utf8');
const updated = source.replace("'__FLIXO_COMMIT__'", `'${commit}'`);
if (updated === source && !source.includes(`'${commit}'`)) throw new Error('Service worker build stamp placeholder was not found.');
await writeFile(file, updated);
console.log(`service-worker commit identity: ${commit}`);
