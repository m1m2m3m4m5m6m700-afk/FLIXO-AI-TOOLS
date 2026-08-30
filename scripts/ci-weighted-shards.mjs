import { readFileSync, existsSync } from 'node:fs';

const requested = Math.max(1, Number.parseInt(process.env.CI_SHARD_COUNT || '4', 10));
const historyPath = process.env.CI_SHARD_HISTORY || 'diagnostics/ci-shard-history.json';
let history = {};
if (existsSync(historyPath)) {
  try { history = JSON.parse(readFileSync(historyPath, 'utf8')); } catch (error) {
    console.warn(`Ignoring invalid shard history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const cases = Object.entries(history)
  .filter(([, seconds]) => Number.isFinite(seconds) && seconds > 0)
  .map(([id, seconds]) => ({ id, seconds: Number(seconds) }))
  .sort((a, b) => b.seconds - a.seconds);

if (cases.length === 0) {
  const shards = Array.from({ length: requested }, (_, index) => ({ index: index + 1, total: requested, estimated_seconds: null, basis: 'equal-fallback' }));
  console.log(JSON.stringify({ version: 1, basis: 'equal-fallback', shards }, null, 2));
  process.exit(0);
}

const bins = Array.from({ length: requested }, (_, index) => ({ index: index + 1, total: requested, seconds: 0, cases: [] }));
for (const test of cases) {
  bins.sort((a, b) => a.seconds - b.seconds || a.index - b.index);
  bins[0].cases.push(test.id);
  bins[0].seconds += test.seconds;
}

const result = {
  version: 1,
  basis: 'historical-duration',
  requested_shards: requested,
  shards: bins.sort((a, b) => a.index - b.index).map((bin) => ({
    index: bin.index,
    total: requested,
    estimated_seconds: Math.round(bin.seconds),
    case_count: bin.cases.length,
    cases: bin.cases,
  })),
};
console.log(JSON.stringify(result, null, 2));
