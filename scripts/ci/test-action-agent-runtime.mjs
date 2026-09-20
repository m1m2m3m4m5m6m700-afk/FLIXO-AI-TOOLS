#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='scripts/ci/action-agent-runtime.mjs';
const src=fs.readFileSync(path,'utf8');
for(const marker of [
  'ACTION-AGENT-RUNTIME-v1',
  'INTAKE','CONTEXT_RETRIEVAL','SELF_CHECK','INDEPENDENT_REVIEW','VERIFY','LEARN',
  'exactShaRequired:true','evidenceFirst:true','failClosed:true',
  'doNotRepeat','historicalActivity','toolBudget','singleActiveMutationOwner',
  'DAILY_FLIXO_GREEN_GATE'
]) assert.ok(src.includes(marker),'missing:'+marker);
console.log('ACTION AGENT RUNTIME CONTRACT PASS');
