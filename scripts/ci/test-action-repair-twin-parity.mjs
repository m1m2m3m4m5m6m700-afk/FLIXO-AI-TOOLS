#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json','utf8'));
const a=profile.roleMatrix['ACTION-REPAIR'];
const b=profile.roleMatrix['ACTION-REPAIR-2'];
const strip=(x)=>[...(x.intelligenceCapabilities||x.capabilities||[])]
  .filter((item)=>item!=='CAN_MUTATE_SOURCE_WHEN_OWNER'&&!/^CAN_MUTATE_SOURCE/.test(item))
  .sort();
assert.deepEqual(strip(a),strip(b));
assert.equal(a.mutationAuthority,'OWNER_ONLY');
assert.notEqual(b.mutationAuthority,'OWNER_ONLY');
assert.match(a.mission,/THINK_AS_PROGRAMMER/);
assert.match(b.mission,/THINK_AS_PROGRAMMER/);
console.log(JSON.stringify({
  status:'PASS',
  protocol:'ACTION-PROGRAMMER-TWIN-PARITY-v1',
  intelligenceParity:'EXACT',
  mutationAuthoritySeparation:true
},null,2));
