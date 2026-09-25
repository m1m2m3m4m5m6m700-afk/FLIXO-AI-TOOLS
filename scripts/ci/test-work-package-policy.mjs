#!/usr/bin/env node
import assert from 'node:assert/strict'; import {execFileSync} from 'node:child_process'; import fs from 'node:fs';
const s=fs.readFileSync('scripts/ci/work-package-policy.mjs','utf8');
assert.match(s,/ONE_WORK_PACKAGE_PER_REPAIR_BURST/); assert.match(s,/WORK_PACKAGE_BURST_REQUIRES_EXACTLY_ONE_WP_TAG/); assert.match(s,/WP-/); assert.match(s,/burstWorkPackages/); assert.match(s,/workPackageIds/); assert.match(s,/workPackageBoundary/); assert.match(s,/activeWorkPackage/);
execFileSync(process.execPath,['scripts/ci/work-package-policy.mjs','d0b6b2edfba752cc19b7b37809e062894910fd51','HEAD'],{stdio:'inherit',env:{...process.env,FLIXO_WP_BURST_THRESHOLD:'99'}});
console.log('WORK_PACKAGE_POLICY_TEST=PASS');
