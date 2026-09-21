#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const root=process.cwd();
const registryPath=path.join(root,'docs/agents/CELL-BOT-REGISTRY.json');
const out=process.env.FLIXO_CELL_WAKE_OUTPUT??'/tmp/flixo-cell-wake.json';
const branch=String(process.env.FLIXO_WAKE_BRANCH??'execution');
const sha=String(process.env.FLIXO_WAKE_SHA??'').trim();
const event=String(process.env.FLIXO_WAKE_EVENT??'push');
if(!/^[a-f0-9]{40}$/iu.test(sha)) throw new Error('CELL_WAKE_EXACT_SHA_REQUIRED');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
if(!Array.isArray(registry.bots)||registry.bots.length!==200) throw new Error('CELL_WAKE_200_BOTS_REQUIRED');
const { ensureCellPool } = await import('./cell-bootstrap-200.mjs');
const runtimePool=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-cell-pool-'));
try {
  const bootstrap=ensureCellPool(runtimePool);
  if(bootstrap.botCount!==200) throw new Error('CELL_WAKE_BOOTSTRAP_200_REQUIRED');
  const personalMemoryCount=fs.readdirSync(path.join(runtimePool,'diagnostics/auto-repair/cell-bots')).filter(x=>/^CELL-\d{3}\.json$/u.test(x)).length;
const digest=crypto.createHash('sha256').update(JSON.stringify({sha,branch,registryVersion:registry.schemaVersion,botCount:registry.bots.length}),'utf8').digest('hex');
const packet={
 schemaVersion:1,
 authority:'CELL_WAKE_PREPARATION',
 event,
 branch,
 exactSha:sha,
 readiness:'AWAKE_AND_READY',
 wholeCell:{botCount:200,personalMemoryFiles:personalMemoryCount,controller:registry.supervisor?.role??'assistantController',council:registry.cellCouncil?.seats?.map(seat=>seat.id)??[]},
 nextStage:'CANONICAL_DAILY_GREEN_GATE',
 directMutation:false,
 directRepairDispatch:false,
 digest,
 generatedAt:new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(packet,null,2)+'\n');
  console.log(JSON.stringify(packet,null,2));
} finally {
  fs.rmSync(runtimePool,{recursive:true,force:true});
}
