import { spawnSync } from 'node:child_process';

function runNpmOutdated() {
  const result = spawnSync('npm', ['outdated', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`Failed to run npm outdated: ${result.error.message}`);
  }

  const stdout = (result.stdout ?? '').trim();
  const stderr = (result.stderr ?? '').trim();

  // npm outdated intentionally exits non-zero when updates are available.
  // Treat that as diagnostic data; only an execution/parsing failure is fatal.
  if (!stdout) {
    if (result.status === 0 || result.status === 1) return {};
    throw new Error(
      `npm outdated produced no JSON (exit ${result.status}): ${stderr || 'no stderr output'}`,
    );
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse npm outdated output (exit ${result.status}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const outdated = runNpmOutdated();
const entries = Object.entries(outdated)
  .map(([name, info]) => ({
    name,
    current: info?.current ?? null,
    wanted: info?.wanted ?? null,
    latest: info?.latest ?? null,
    type: info?.type ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log('Dependency health inventory');
console.log(`Outdated packages: ${entries.length}`);
for (const entry of entries) {
  console.log(
    `${entry.name}: current=${entry.current} wanted=${entry.wanted} latest=${entry.latest} type=${entry.type}`,
  );
}

// Inventory is intentionally informational. Blocking policy belongs in the
// dedicated production audit and install-resolution gates.
process.exit(0);
