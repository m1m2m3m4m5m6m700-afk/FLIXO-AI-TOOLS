import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = process.cwd();
const args = process.argv.slice(2);
const mode = args.find((x) => x.startsWith('--mode='))?.slice(7)
  ?? (process.env.GITHUB_EVENT_NAME === 'pull_request' ? 'pr' : 'main');
const explicitBase = args.find((x) => x.startsWith('--base='))?.slice(7) ?? null;
const history = JSON.parse(readFileSync('ci/test-duration-history.json', 'utf8'));
const fastSpecs = Object.keys(history.tests)
  .filter((name) => name !== 'localization')
  .map((name) => `tests/${name}.spec.ts`);
const weights = Object.fromEntries(
  Object.entries(history.tests)
    .filter(([name]) => name !== 'localization')
    .map(([name, value]) => [`tests/${name}.spec.ts`, Math.max(1, Number(value.weight) || 1)]),
);
const shardCount = 2;

const git = (gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
const head = git(['rev-parse', 'HEAD']);
const eventBase = process.env.GITHUB_BASE_SHA || process.env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA || null;
const base = explicitBase ?? eventBase ?? null;

let changedFiles = ['<main>'];
if (mode === 'pr') {
  if (!base) throw new Error('ACCEL-5 requires an explicit PR base SHA; refusing unsafe selective execution.');
  try {
    git(['cat-file', '-e', `${base}^{commit}`]);
  } catch {
    try {
      git(['fetch', '--no-tags', '--depth=1', 'origin', base]);
    } catch (error) {
      throw new Error(`Unable to fetch PR base ${base}; refusing selective execution: ${error.message}`, { cause: error });
    }
  }
  changedFiles = git(['diff', '--name-only', `${base}...${head}`]).split(/\r?\n/).filter(Boolean);
}

const directTestChanges = changedFiles.filter(
  (file) => /^tests\/[^/]+\.spec\.ts$/u.test(file) && fastSpecs.includes(file),
);
const unsafeForSelectiveBrowser = mode !== 'pr' || changedFiles.some((file) => (
  file === '<main>'
  || !/^tests\/[^/]+\.spec\.ts$/u.test(file)
  || file.startsWith('.github/workflows/')
  || file === 'playwright.config.ts'
  || file === 'package.json'
  || file === 'package-lock.json'
  || file === '.nvmrc'
));

const selectedFastSpecs = mode === 'pr' && !unsafeForSelectiveBrowser && directTestChanges.length > 0
  ? directTestChanges
  : fastSpecs;

const bins = Array.from(
  { length: shardCount },
  (_, index) => ({ shard: index + 1, weight: 0, specs: [] }),
);
for (const spec of [...selectedFastSpecs].sort(
  (a, b) => (weights[b] ?? 1) - (weights[a] ?? 1) || a.localeCompare(b),
)) {
  bins.sort((a, b) => a.weight - b.weight || a.shard - b.shard);
  bins[0].specs.push(spec);
  bins[0].weight += weights[spec] ?? 1;
}
const plan = bins.map((bin) => ({ ...bin, specs: [...bin.specs].sort() }));
const totalWeight = plan.reduce((sum, bin) => sum + bin.weight, 0);
const spread = plan.length > 1
  ? Math.max(...plan.map((bin) => bin.weight)) - Math.min(...plan.map((bin) => bin.weight))
  : 0;

const output = {
  schema: 'flixo-accel-456/v2',
  mode,
  head,
  base,
  changedFiles,
  impact: {
    strategy: mode === 'pr' && !unsafeForSelectiveBrowser ? 'DIRECT_TEST_IMPACT' : 'FULL_FALLBACK',
    unsafeForSelectiveBrowser,
    selectedFastSpecs,
    selectedCount: selectedFastSpecs.length,
    totalCanonicalFastSpecs: fastSpecs.length,
  },
  balancedFastShards: {
    shardCount,
    plan,
    totalWeight,
    spread,
    balanced: spread <= Math.max(2, Math.ceil(totalWeight / shardCount)),
  },
  deep: {
    strategy: 'FULL_20_LOCALE_MATRIX',
    shardCount: 3,
    localeGroups: [
      ['ar', 'en', 'es', 'fr', 'de'],
      ['hi', 'id', 'it', 'ja', 'ko', 'ms', 'nl'],
      ['pl', 'pt', 'ru', 'sv', 'th', 'tr', 'uk', 'vi'],
    ],
  },
  runtime: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    canonicalFastRetries: 0,
    configRetries: 2,
    reuseExistingServerSupported: true,
    safety: 'Do not share pages/contexts across tests unless fixture isolation is proven.',
  },
  evidence: {
    historySha256: createHash('sha256').update(readFileSync('ci/test-duration-history.json')).digest('hex'),
    exactSha: head,
  },
};

mkdirSync('diagnostics/ci', { recursive: true });
writeFileSync('diagnostics/ci/accel-456-plan.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!output.balancedFastShards.balanced) process.exit(1);
