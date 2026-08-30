import { existsSync, readFileSync } from 'node:fs';

const requested = Math.max(1, Number.parseInt(process.env.CI_SHARD_COUNT || '4', 10));
const historyPath = process.env.CI_SHARD_HISTORY || 'diagnostics/ci-shard-history.json';
let history = {};

if (existsSync(historyPath)) {
  try {
    history = JSON.parse(readFileSync(historyPath, 'utf8'));
  } catch (error) {
    console.warn(`Ignoring invalid shard history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const cases = Object.entries(history)
  .filter(([, seconds]) => Number.isFinite(Number(seconds)) && Number(seconds) > 0)
  .map(([id, seconds]) => ({ id, seconds: Number(seconds) }))
  .sort((a, b) => b.seconds - a.seconds || a.id.localeCompare(b.id));

const bins = Array.from({ length: requested }, (_, index) => ({
  index: index + 1,
  total: requested,
  estimated_seconds: 0,
  cases: [],
}));

if (cases.length === 0) {
  console.log(JSON.stringify({
    schema_version: 1,
    basis: 'equal-fallback',
    requested_shards: requested,
    shards: bins.map((bin) => ({
      index: bin.index,
      total: requested,
      estimated_seconds: null,
      case_count: 0,
      cases: [],
    })),
  }, null, 2));
  process.exit(0);
}

for (const testCase of cases) {
  bins.sort((a, b) => a.estimated_seconds - b.estimated_seconds || a.index - b.index);
  bins[0].cases.push(testCase.id);
  bins[0].estimated_seconds += testCase.seconds;
}

console.log(JSON.stringify({
  schema_version: 1,
  basis: 'historical-duration',
  requested_shards: requested,
  shards: bins.sort((a, b) => a.index - b.index).map((bin) => ({
    index: bin.index,
    total: requested,
    estimated_seconds: Math.round(bin.estimated_seconds),
    case_count: bin.cases.length,
    cases: bin.cases,
  })),
}, null, 2));
