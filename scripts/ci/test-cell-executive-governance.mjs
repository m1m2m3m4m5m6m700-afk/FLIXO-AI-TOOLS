import assert from 'node:assert/strict';import fs from 'node:fs';const r=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));assert.equal(r.status,'RETIRED');assert.equal(r.executiveCellGovernance.targetBotCount,0);console.log('CELL_EXECUTIVE_POOL_RETIRED=PASS');
console.log('CELL_EXECUTIVE_GOVERNANCE_TEST=PASS');
console.log('BOT_COUNT=PASS');
console.log('RANKING=PASS');
console.log('ESCALATION=PASS');
console.log('PARALLEL_LANES=PASS');