import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const ci = read('.github/workflows/ci.yml');
const s4 = read('.github/workflows/s4-runtime-e2e.yml');
const full = read('.github/workflows/full-matrix-promotion.yml');
const loc = read('.github/workflows/localization-20.yml');
const diagnostics = [read('.github/workflows/parallel-diagnostics.yml'), read('.github/workflows/root-cause-diagnostics.yml')];

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(!ci.includes('browser-smoke'), 'canonical CI contains duplicate browser-smoke ownership');
expect(/canonical-verify:[\s\S]*?needs:/.test(ci), 'canonical aggregator is missing prerequisite dependency');
expect(!(/canonical-verify:[\s\S]*?(npm test|npm run verify\b)/.test(ci)), 'canonical aggregator executes verification work');
expect(/s4-build:[\s\S]*?npm run build/.test(s4), 'S4 build-once stage is missing');
expect(/Download immutable runtime artifact/.test(s4), 'S4 runtime does not consume immutable build artifact');
expect(/test \"\$certified_sha\" = \"\$GITHUB_SHA\"/.test(s4), 'S4 exact-SHA verification missing');
expect(/build-once:/.test(full) && /Download immutable certification artifact/.test(full), 'Full Matrix build-once artifact graph missing');
expect((full.match(/image-compressor/g) || []).length >= 1 && (full.match(/webkit/g) || []).length >= 1, 'Full Matrix browser/tool coverage is incomplete');
expect((loc.match(/- en\b/g) || []).length >= 1 && (loc.match(/- sv\b/g) || []).length >= 1, 'Localization 20-locale surface appears incomplete');
expect(diagnostics.every((w) => /workflow_dispatch:/.test(w) && !/pull_request:\s*\n|push:\s*\n/.test(w)), 'diagnostic workflows must remain manual-only');

if (failures.length) {
  console.error('CI architecture contract FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CI architecture contract PASSED: unique ownership, build-once artifacts, fail-closed SHA binding, full browser/locale surfaces, and manual-only diagnostics are enforced.');
