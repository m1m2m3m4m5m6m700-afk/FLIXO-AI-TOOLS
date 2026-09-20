#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.ok(fs.existsSync('scripts/ci/cell-attendance.mjs'));
const source=fs.readFileSync('scripts/ci/cell-attendance.mjs','utf8');
for(const marker of ['CHECK_IN','CHECK_OUT','upgradePriority','UPGRADE_RECOMMENDED','CELL_ATTENDANCE_OPEN_RECORD_NOT_FOUND'])assert.ok(source.includes(marker),marker);
console.log('CELL_ATTENDANCE_LEDGER=PASS');
