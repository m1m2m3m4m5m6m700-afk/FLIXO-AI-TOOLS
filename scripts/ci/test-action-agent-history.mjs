#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const p='scripts/ci/action-agent-history.mjs';
const s=fs.readFileSync(p,'utf8');
for(const m of ['PROVISIONAL','VERIFIED','DAILY_FLIXO_GREEN_GATE','targetSha','failedRunId','byFingerprint','byAgent','timeline'])assert.ok(s.includes(m),'missing:'+m);
console.log('ACTION AGENT HISTORICAL ACTIVITY CONTRACT PASS');
