#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repo = String(process.env.GITHUB_REPOSITORY ?? '').trim();
const output = process.env.FLIXO_PLATFORM_RECEIPT_PATH ?? '/tmp/flixo-platform-publication-receipt.json';

const requiredContextAliases = Object.freeze([
  [
    'FLIXO Master Repair Governor / trust-gate',
    'trust-gate',
  ],
  [
    'FLIXO Auto Repair Merge Gate / Exact-SHA promotion proof',
    'Exact-SHA promotion proof',
  ],
]);

const requiredContexts = requiredContextAliases.map(([canonical]) => canonical);

if (!repo) throw new Error('PLATFORM_BOUNDARY_GITHUB_REPOSITORY_REQUIRED');

const gh = (args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).trim();

let activeBranchRules;
let main;
try {
  // The branch-rules endpoint returns the active rules that actually apply to
  // main and only needs repository metadata read access. This is more
  // authoritative for enforcement than relying on the repository ruleset list,
  // which may be unavailable to the workflow token.
  activeBranchRules = JSON.parse(
    gh(['api', 'repos/' + repo + '/rules/branches/main']),
  );
  main = JSON.parse(gh(['api', 'repos/' + repo + '/branches/main']));
} catch (error) {
  throw new Error(
    'PLATFORM_BOUNDARY_API_UNAVAILABLE:' + String(error?.message ?? error),
    { cause: error },
  );
}

const activeRules = Array.isArray(activeBranchRules) ? activeBranchRules : [];

const requiredStatusSets = activeRules
  .filter((rule) => rule?.type === 'required_status_checks')
  .flatMap((rule) =>
    rule?.parameters?.required_status_checks ?? [],
  )
  .map((item) =>
    typeof item === 'string' ? item : item?.context,
  )
  .filter(Boolean);

const activeRuleIds = [
  ...new Set(
    activeRules
      .map((rule) => rule?.ruleset_id)
      .filter((id) => Number.isInteger(id)),
  ),
];

const mainScoped = activeRuleIds.map((id) => ({
  id,
  source: 'active-branch-rules',
}));

const failures = [];

if (main?.protected !== true && mainScoped.length === 0) {
  failures.push('MAIN_PLATFORM_PROTECTION_MISSING');
}

if (!mainScoped.length) {
  failures.push('ACTIVE_MAIN_RULESET_MISSING');
}

for (const [canonical, shortName] of requiredContextAliases) {
  const present = requiredStatusSets.some(
    (context) => context === canonical || context === shortName,
  );
  if (!present) {
    failures.push('REQUIRED_PLATFORM_STATUS_MISSING:' + canonical);
  }
}

if (!/^[a-f0-9]{40}$/u.test(String(main?.commit?.sha ?? ''))) {
  failures.push('MAIN_SHA_UNAVAILABLE');
}

const receipt = {
  schemaVersion: 2,
  protocol: 'FLIXO-PLATFORM-PUBLICATION-BOUNDARY-v2',
  authority: 'EXTERNAL_PLATFORM_ATTESTATION',
  repository: repo,
  platform: 'GitHub',
  mainProtected: main?.protected === true,
  activeMainRulesets: mainScoped,
  requiredStatusContexts: [...new Set(requiredStatusSets)],
  requiredContexts,
  mainSha: main?.commit?.sha ?? null,
  status: failures.length ? 'UNTRUSTED' : 'VERIFIED',
  failures,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(
  output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.',
  { recursive: true },
);
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));

if (receipt.status !== 'VERIFIED') process.exitCode = 2;
