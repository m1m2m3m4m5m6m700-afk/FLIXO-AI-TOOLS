#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='scripts/ci/action-agent-runtime.mjs';
const src=fs.readFileSync(path,'utf8');
for(const marker of [
  'ACTION-AGENT-RUNTIME-v2',
  'INTAKE','CONTEXT_RETRIEVAL','SELF_CHECK','INDEPENDENT_REVIEW','VERIFY','LEARN',
  'exactShaRequired:true','evidenceFirst:true','failClosed:true',
  'doNotRepeat','historicalActivity','toolBudget','singleActiveMutationOwner',
  'SYNTHESIZE','SIMULATE','DIFFERENTIAL_VERIFY','buildRepairEngineeringPlan','repairEngineering',
  'DAILY_FLIXO_GREEN_GATE'
]) assert.ok(src.includes(marker),'missing:'+marker);
assert.ok(fs.existsSync('scripts/ci/action-patch-synthesis.mjs'),'missing patch synthesis runtime');
assert.ok(fs.existsSync('scripts/ci/action-repair-sandbox.mjs'),'missing sandbox runtime');
assert.ok(fs.existsSync('scripts/ci/action-differential-verifier.mjs'),'missing differential verifier runtime');
console.log('ACTION AGENT RUNTIME CONTRACT PASS');
