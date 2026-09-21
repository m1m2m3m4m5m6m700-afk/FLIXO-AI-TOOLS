#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const registryPath=path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');
const SHA=/^[a-f0-9]{40}$/iu;
const sha=String(process.env.FLIXO_CELL_EXACT_SHA??'').trim();
if(!SHA.test(sha)) throw new Error('CELL_WAKE_EXACT_SHA_REQUIRED');

const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
if(!Array.isArray(registry.bots)||registry.bots.length!==200) throw new Error('CELL_WAKE_REQUIRES_200_BOTS');
if(registry.bots.some((bot)=>!/^CELL-\d{3}$/u.test(String(bot.id)))) throw new Error('CELL_WAKE_INVALID_BOT_ID');
if(registry.swarmPolicy?.registeredBots!==200) throw new Error('CELL_WAKE_SWARM_POLICY_INVALID');
if(registry.cellCouncil?.seats?.length!==3) throw new Error('CELL_WAKE_COUNCIL_INVALID');

const result=spawnSync(process.execPath,['scripts/ci/cell-wake-preparation.mjs'],{
  cwd:ROOT,
  env:{...process.env,FLIXO_WAKE_SHA:sha,FLIXO_WAKE_BRANCH:process.env.FLIXO_CELL_BRANCH??'execution',FLIXO_WAKE_EVENT:process.env.FLIXO_CELL_EVENT??'manual'},
  encoding:'utf8'
});
if(result.status!==0) throw new Error((result.stderr||result.stdout||'CELL_WAKE_PREPARATION_FAILED').trim());

const packet=JSON.parse(result.stdout);
const cell={
 schemaVersion:1,
 authority:'CELL_WAKE_RUNTIME',
 exactSha:sha,
 readiness:packet.readiness,
 botCount:packet.wholeCell.botCount,
 personalMemoryFiles:packet.wholeCell.personalMemoryFiles,
 councilSeats:packet.wholeCell.council,
 controller:packet.wholeCell.controller,
 actionRepairIncluded:false,
 directMutation:false,
 directRepairDispatch:false,
 canonicalProofAuthority:'CI_ONLY',
 digest:crypto.createHash('sha256').update(JSON.stringify(packet),'utf8').digest('hex'),
 generatedAt:new Date().toISOString()
};
const out=process.env.FLIXO_CELL_WAKE_RUNTIME_OUTPUT??'/tmp/flixo-cell-wake-runtime.json';
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(cell,null,2)+'\n');
console.log(JSON.stringify(cell,null,2));
