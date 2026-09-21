#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('scripts/ci/promote-action-agent-history.mjs','utf8');
for(const m of ["status!=='GREEN'","exactShaVerified","DAILY_FLIXO_GREEN_GATE","PROVISIONAL","VERIFIED","targetSha"]) assert.ok(s.includes(m),'missing:'+m);
console.log('ACTION AGENT HISTORY PROMOTION CONTRACT PASS');