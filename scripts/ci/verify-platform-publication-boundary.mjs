#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repo = String(process.env.GITHUB_REPOSITORY ?? '').trim();
const output = process.env.FLIXO_PLATFORM_RECEIPT_PATH ?? '/tmp/flixo-platform-publication-receipt.json';
const requiredContexts = [
  'FLIXO Master Repair Governor / trust-gate',
  'FLIXO Auto Repair Merge Gate / Exact-SHA promotion proof',
];
if (!repo) throw new Error('PLATFORM_BOUNDARY_GITHUB_REPOSITORY_REQUIRED');
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();

let rulesets;
let main;
try {
  rulesets = JSON.parse(gh(['api', 'repos/' + repo + '/rulesets?includes_parents=true']));
  main = JSON.parse(gh(['api', 'repos/' + repo + '/branches/main']));
} catch (error) {
  throw new Error('PLATFORM_BOUNDARY_API_UNAVAILABLE:' + String(error?.message ?? error), { cause: error });
}

const active = Array.isArray(rulesets) ? rulesets.filter((x) => String(x?.enforcement).toLowerCase() === 'active') : [];
const mainScoped = active.filter((x) =>
  (x?.conditions?.ref_name?.include ?? []).some((v) => String(v).includes('main'))
);
const requiredStatusSets = mainScoped.flatMap((rule) =>
  (rule?.rules ?? [])
    .filter((item) => item?.type === 'required_status_checks')
    .flatMap((item) => item?.parameters?.required_status_checks ?? [])
    .map((item) => typeof item === 'string' ? item : item?.context)
    .filter(Boolean)
);

const failures = [];
if (main?.protected !== true && mainScoped.length === 0) failures.push('MAIN_PLATFORM_PROTECTION_MISSING');
if (!mainScoped.length) failures.push('ACTIVE_MAIN_RULESET_MISSING');
for (const context of requiredContexts) {
  if (!requiredStatusSets.includes(context)) failures.push('REQUIRED_PLATFORM_STATUS_MISSING:' + context);
}
if (!/^[a-f0-9]{40}$/u.test(String(main?.commit?.sha ?? ''))) failures.push('MAIN_SHA_UNAVAILABLE');

const receipt = {
  schemaVersion: 1,
  protocol: 'FLIXO-PLATFORM-PUBLICATION-BOUNDARY-v1',
  authority: 'EXTERNAL_PLATFORM_ATTESTATION',
  repository: repo,
  platform: 'GitHub',
  mainProtected: main?.protected === true,
  activeMainRulesets: mainScoped.map((x) => ({
    id: x.id ?? null,
    name: x.name ?? null,
    enforcement: x.enforcement ?? null,
  })),
  requiredStatusContexts: requiredStatusSets,
  requiredContexts,
  mainSha: main?.commit?.sha ?? null,
  status: failures.length ? 'UNTRUSTED' : 'VERIFIED',
  failures,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.', { recursive: true });
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (receipt.status !== 'VERIFIED') process.exitCode = 2;
