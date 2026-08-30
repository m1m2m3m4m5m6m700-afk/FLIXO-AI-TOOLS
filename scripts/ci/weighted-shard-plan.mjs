import { readFileSync } from 'node:fs';

const historyPath = 'ci/test-duration-history.json';
const history = JSON.parse(readFileSync(historyPath, 'utf8'));
const requested = Number(process.env.CI_SHARD_COUNT || history.shardBudget.default);
const maximum = Number(process.env.CI_MAX_SHARDS || history.shardBudget.maximum);
const reserve = Number(process.env.CI_RUNNER_RESERVE || history.shardBudget.reserve);
const runnerBudget = Math.max(1, Number(process.env.CI_RUNNER_BUDGET || Math.max(1, requested + reserve)) - reserve);
const shardCount = Math.max(1, Math.min(requested, maximum, runnerBudget));
const entries = Object.entries(history.tests).map(([name, value]) => ({ name, weight: Math.max(1, Number(value.weight) || 1) }));
if (!entries.length) throw new Error('No test weights configured.');

const total = entries.reduce((sum, item) => sum + item.weight, 0);
const bins = Array.from({ length: shardCount }, (_, index) => ({ shard: index + 1, weight: 0, tests: [] }));
for (const item of [...entries].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))) {
  bins.sort((a, b) => a.weight - b.weight || a.shard - b.shard);
  bins[0].tests.push(item.name);
  bins[0].weight += item.weight;
}

const plan = bins.filter((bin) => bin.tests.length).map((bin) => ({ ...bin, ratio: Number((bin.weight / total).toFixed(4)) }));
const spread = Math.max(...plan.map((bin) => bin.weight)) - Math.min(...plan.map((bin) => bin.weight));
if (spread > Math.max(2, Math.ceil(total / shardCount))) {
  throw new Error(`Shard plan is too imbalanced: spread=${spread}, total=${total}, shards=${shardCount}`);
}

const output = JSON.stringify(plan);
console.log(output);
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `plan=${output}\nshard_count=${plan.length}\n`);
}
