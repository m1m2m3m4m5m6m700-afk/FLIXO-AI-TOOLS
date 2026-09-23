#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';const p=path.resolve(process.cwd(),'docs/agents/CELL-BOT-REGISTRY.json');
export function loadCellControllerState(){const r=JSON.parse(fs.readFileSync(p,'utf8'));if(r.status!=='RETIRED'||r.bots?.length!==0)throw new Error('CELL_CONTROLLER_RETIREMENT_STATE_INVALID');return {registry:r,controller:r.supervisor?.role??'assistantController'};}
export function selectBotForTask(){loadCellControllerState();throw new Error('CELL_CONTROLLER_POOL_RETIRED');}if(import.meta.url===`file://${process.argv[1]}`)selectBotForTask();