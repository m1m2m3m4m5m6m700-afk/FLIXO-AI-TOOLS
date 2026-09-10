import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const expectedSha = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']);
const baseSha = process.env.CHANGE_BASE ?? '';
const out = process.env.ORCHESTRATOR_OUTPUT ?? 'diagnostics/orchestrator';

function changedFiles() {
  try {
    if (baseSha) return git(['diff', '--name-only', `${baseSha}...HEAD`]).split('\n').filter(Boolean);
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean);
  } catch (error) {
    throw new Error(`Unable to determine changed files: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function impact(files) {
  const areas = new Set();
  for (const f of files) {
    if (f.startsWith('.github/workflows/') || f.startsWith('scripts/ci/')) areas.add('CI');
    if (f.startsWith('src/routes/') || f.includes('/route')) areas.add('ROUTING');
    if (f.startsWith('src/lib/i18n/') || f.includes('locale')) areas.add('I18N');
    if (f.startsWith('src/lib/seo/') || /seo|sitemap/i.test(f)) areas.add('SEO');
    if (f.includes('tool-manifest') || f.includes('/tools/')) areas.add('G1');
    if (f.includes('file-safety') || f.includes('upload-boundary')) areas.add('G2');
    if (f.includes('output-integrity') || f.includes('/g3/')) areas.add('G3');
    if (f.startsWith('tests/') || /playwright/i.test(f)) areas.add('G4');
    if (/\.(tsx|jsx)$/.test(f)) areas.add('UI');
    if (/package(-lock)?\.json|tsconfig|vite\.config|vercel\.json/.test(f)) areas.add('BUILD');
  }
  return [...areas].sort();
}

let files;
try {
  files = changedFiles();
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const actualSha = git(['rev-parse', 'HEAD']);
const treeSha = git(['rev-parse', 'HEAD^{tree}']);
const worktree = git(['status', '--porcelain']);
const areas = impact(files);
const highRisk = areas.some((a) => ['CI', 'G1', 'G2', 'G3', 'BUILD'].includes(a));
const browserRequired = areas.some((a) => ['ROUTING', 'I18N', 'SEO', 'G4', 'UI', 'G1', 'G2', 'G3'].includes(a));
const plan = {
  schemaVersion: 1,
  role: 'DETERMINISTIC_ORCHESTRATOR',
  sha: expectedSha,
  actualSha,
  treeSha,
  baseSha: baseSha || null,
  worktreeClean: worktree === '',
  changedFiles: files,
  impactAreas: areas,
  risk: highRisk ? 'HIGH' : areas.length ? 'MEDIUM' : 'LOW',
  execution: {
    static: true,
    contracts: highRisk || areas.length > 0,
    build: true,
    security: highRisk,
    targetedTests: areas.length > 0,
    browser: browserRequired,
    releaseCertification: true,
  },
  ownership: {
    canonicalValidation: 'existing npm scripts / verify engine',
    orchestration: 'scripts/ci/unified-orchestrator.mjs',
    deployment: '.github/workflows/cd.yml',
  },
  policy: [
    'No duplicate canonical validators are executed by this planner.',
    'Browser execution is selected by impact, not by default.',
    'Release certification requires Exact-SHA and clean-worktree evidence.',
    'CI failure remains failure; no continue-on-error is introduced.',
  ],
};
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/plan.json`, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify(plan, null, 2));
if (actualSha !== expectedSha) {
  console.error(`❌ Exact-SHA mismatch: expected ${expectedSha}, got ${actualSha}`);
  process.exitCode = 1;
}
if (worktree) {
  console.error('❌ Working tree is dirty; orchestration requires a clean checkout.');
  process.exitCode = 1;
}
