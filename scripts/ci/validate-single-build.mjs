#!/usr/bin/env node
import fs from 'node:fs';

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const failures = [];

const section = (name, nextNames) => {
  const start = ci.indexOf(`  ${name}:`);
  if (start < 0) return '';
  const rest = ci.slice(start);
  const offsets = nextNames.map((next) => rest.indexOf(`\n  ${next}:`)).filter((offset) => offset > 0);
  const end = offsets.length ? Math.min(...offsets) : rest.length;
  return rest.slice(0, end);
};

const verify = section('verify', ['browser_fast', 'browser_deep', 'certify']);
const fast = section('browser_fast', ['browser_deep', 'certify']);
const deep = section('browser_deep', ['certify']);
const certify = section('certify', []);

if (!verify.includes('name: Static + Build')) failures.push('CANONICAL_BUILD_OWNER_MISSING');
if (!(verify.includes('uses: actions/upload-artifact@v6') || verify.includes('uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0')) || !verify.includes('name: flixo-build-${{ github.run_id }}')) failures.push('CANONICAL_BUILD_ARTIFACT_MISSING');
for (const [name, text] of [['browser_fast', fast], ['browser_deep', deep], ['certify', certify]]) {
  if (!(text.includes('actions/download-artifact@v7') || text.includes('actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0'))) failures.push(`${name}: BUILD_ARTIFACT_CONSUMPTION_MISSING`);
  if (/npm\s+run\s+build(?!:runtime)/.test(text)) failures.push(`${name}: REBUILD_DETECTED`);
  if (/vite\s+build/.test(text)) failures.push(`${name}: DIRECT_BUILD_DETECTED`);
}
if (!/needs:\s*\[verify\]/.test(fast) || !/needs:\s*\[verify\]/.test(deep)) failures.push('BROWSER_JOBS_MUST_DEPEND_ON_CANONICAL_BUILD');
if (!/needs:\s*\[verify, browser_fast, browser_deep\]/.test(certify)) failures.push('CERTIFICATION_DEPENDENCY_GRAPH_INVALID');

console.log(failures.length ? failures.map((failure) => `FAIL: ${failure}`).join('\n') : 'SINGLE_BUILD_POLICY_PASS');
if (failures.length) process.exit(1);
