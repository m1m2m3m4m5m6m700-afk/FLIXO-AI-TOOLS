import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const manifestPath = join(dist, '_flixo_build_manifest.json');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (full === manifestPath) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) {
      const bytes = readFileSync(full);
      files.push({
        path: relative(dist, full).replaceAll('\\\\', '/'),
        bytes: statSync(full).size,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
};

walk(dist);
files.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  schema: 'flixo.build-artifact.v1',
  sha: process.env.GITHUB_SHA ?? 'unknown',
  run_id: process.env.GITHUB_RUN_ID ?? 'unknown',
  workflow: process.env.GITHUB_WORKFLOW ?? 'unknown',
  event: process.env.GITHUB_EVENT_NAME ?? 'unknown',
  created_at: new Date().toISOString(),
  file_count: files.length,
  files,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\\n`);
console.log(`Build artifact manifest written: ${files.length} files for ${manifest.sha}`);
