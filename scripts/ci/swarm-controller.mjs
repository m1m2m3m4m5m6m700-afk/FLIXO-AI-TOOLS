#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';const p=path.join(process.cwd(),'docs/agents/CELL-BOT-REGISTRY.json');
export function loadSwarmRegistry(){const r=JSON.parse(fs.readFileSync(p,'utf8'));if(r.status!=='RETIRED'||r.bots?.length!==0)throw new Error('SWARM_RETIREMENT_STATE_INVALID');return r;}
export function planSwarm(){const r=loadSwarmRegistry();return {status:'RETIRED',botCount:r.bots.length,reason:'CELL_POOL_RETIRED_BY_USER_DIRECTIVE'};}if(import.meta.url===`file://${process.argv[1]}`)console.log(JSON.stringify(planSwarm(),null,2));