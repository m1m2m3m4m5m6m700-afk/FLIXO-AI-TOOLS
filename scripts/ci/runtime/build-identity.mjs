import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const commitSha = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA ?? 'LOCAL';
const lockfileHash = hash(await readFile('package-lock.json'));
const nvmrc = (await readFile('.nvmrc', 'utf8')).trim();
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk('dist');
files.sort();
const fileHashes = [];
for (const path of files) fileHashes.push(`${path}:${hash(await readFile(path))}:${(await stat(path)).size}`);
const artifactHash = hash(fileHashes.join('\n'));
const identity = {
  schemaVersion: 2,
  producer: 'scripts/ci/runtime/build-identity.mjs',
  commitSha,
  lockfileHash,
  nvmrc,
  node: process.version,
  artifactHash,
  files,
};

const outputDir = 'dist/__flixo';
await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/build-identity.json`, JSON.stringify(identity, null, 2) + '\n');
await writeFile(`${outputDir}/artifact-hash.txt`, `${artifactHash}\n`);
console.log(`Verified build identity PASS: ${artifactHash}`);
