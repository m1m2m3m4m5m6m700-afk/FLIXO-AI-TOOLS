import { spawnSync } from 'node:child_process';

function runNpmOutdated() {
  const result = spawnSync('npm', ['outdated', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = (result.stdout ?? '').trim();
  if (!stdout) return {};

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse npm outdated output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const outdated = runNpmOutdated();
const entries = Object.entries(outdated).map(([name, info]) => ({
  name,
  current: info?.current ?? null,
  wanted: info?.wanted ?? null,
  latest: info?.latest ?? null,
  type: info?.type ?? null,
}));

console.log('Dependency health inventory');
console.log(`Outdated packages: ${entries.length}`);
for (const entry of entries) {
  console.log(`${entry.name}: current=${entry.current} wanted=${entry.wanted} latest=${entry.latest} type=${entry.type}`);
}

// Inventory is intentionally informational. Blocking policy belongs in the
// dedicated production audit and install-resolution gates.
process.exit(0);
