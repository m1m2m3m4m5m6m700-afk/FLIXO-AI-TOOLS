import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function runNpmOutdated() {
  const result = spawnSync('npm', ['outdated', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`Failed to run npm outdated: ${result.error.message}`, {
      cause: result.error,
    });
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
      { cause: error },
    );
  }
}

function parseVersion(value) {
  const match = String(value ?? '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function classifyUpdate(current, target) {
  const from = parseVersion(current);
  const to = parseVersion(target);
  if (!from || !to || from.every((part, index) => part === to[index])) return 'none';
  if (to[0] !== from[0]) return 'major';
  if (to[1] !== from[1]) return 'minor';
  return 'patch';
}

const outdated = runNpmOutdated();
const entries = Object.entries(outdated)
  .map(([name, info]) => {
    const current = info?.current ?? null;
    const wanted = info?.wanted ?? null;
    const latest = info?.latest ?? null;
    return {
      name,
      current,
      wanted,
      latest,
      wantedUpdate: classifyUpdate(current, wanted),
      latestUpdate: classifyUpdate(current, latest),
      type: info?.type ?? null,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const summary = entries.reduce(
  (acc, entry) => {
    acc.outdated += 1;
    acc.wanted[entry.wantedUpdate] += 1;
    acc.latest[entry.latestUpdate] += 1;
    return acc;
  },
  {
    outdated: 0,
    wanted: { none: 0, patch: 0, minor: 0, major: 0 },
    latest: { none: 0, patch: 0, minor: 0, major: 0 },
  },
);

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  entries,
};

const jsonPath = process.env.DEPENDENCY_HEALTH_JSON;
if (jsonPath) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log('Dependency health inventory');
console.log(`Outdated packages: ${entries.length}`);
console.log(
  `Wanted updates: ${summary.wanted.patch} patch, ${summary.wanted.minor} minor, ${summary.wanted.major} major`,
);
console.log(
  `Latest updates: ${summary.latest.patch} patch, ${summary.latest.minor} minor, ${summary.latest.major} major`,
);
for (const entry of entries) {
  console.log(
    `${entry.name}: current=${entry.current} wanted=${entry.wanted} latest=${entry.latest} wantedUpdate=${entry.wantedUpdate} latestUpdate=${entry.latestUpdate}`,
  );
}

// Inventory is intentionally informational. Blocking policy belongs in the
// dedicated production audit and install-resolution gates.
process.exit(0);
