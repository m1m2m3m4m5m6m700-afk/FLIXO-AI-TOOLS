import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const distRoot = join(root, 'dist');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files.sort();
}

const files = walk(distRoot).map((file) => {
  const bytes = readFileSync(file);
  return {
    path: relative(distRoot, file).replaceAll('\\', '/'),
    bytes: statSync(file).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
});

const artifactSha = createHash('sha256')
  .update(files.map(({ path, bytes, sha256 }) => `${path}\0${bytes}\0${sha256}`).join('\n'))
  .digest('hex');

const manifest = {
  schema_version: 1,
  artifact_sha256: artifactSha,
  commit_sha: process.env.GITHUB_SHA ?? null,
  run_id: process.env.GITHUB_RUN_ID ?? null,
  workflow: process.env.GITHUB_WORKFLOW ?? null,
  event: process.env.GITHUB_EVENT_NAME ?? null,
  file_count: files.length,
  files,
};

writeFileSync(join(distRoot, '_flixo_build_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ artifact_sha256: artifactSha, file_count: files.length }, null, 2));
