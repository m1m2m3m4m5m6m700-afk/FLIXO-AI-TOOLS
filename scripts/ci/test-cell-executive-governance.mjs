#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=f=>fs.readFileSync(path.resolve(root,f),'utf8');
const policy=read('docs/agents/CELL-EXECUTIVE-OPERATING-POLICY.md');
const registry=JSON.parse(read('docs/agents/CELL-BOT-REGISTRY.json'));
const protocols=JSON.parse(read('docs/PROTOCOL-REGISTRY.json'));
const cooperation=JSON.parse(read('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'));
const failures=[];
if(registry?.executiveCellGovernance?.contractId!=='CELL-EXEC-GOV-001'||registry?.executiveCellGovernance?.status!=='MANDATORY') failures.push('EXECUTIVE_CONTRACT');
if(!Array.isArray(registry?.bots)||registry.bots.length!==200) failures.push('BOT_COUNT');
if(JSON.stringify(registry.executiveCellGovernance?.ranking?.range)!==JSON.stringify([1,200])||registry.executiveCellGovernance?.ranking?.authorityInheritance!==false) failures.push('RANKING');
for(const l of ['L0','L1','L2','L3','L4','L5','L6','L7']) if(!registry.executiveCellGovernance?.escalation?.levels?.[l]) failures.push('ESCALATION_'+l);
if(registry.executiveCellGovernance?.continuousLanes?.repair!=='CONTINUOUS_WHEN_RED'||registry.executiveCellGovernance?.continuousLanes?.developmentLearning!=='CONTINUOUS_ON_DISJOINT_SCOPE') failures.push('PARALLEL_LANES');
for(let i=0;i<registry.bots.length;i++){const b=registry.bots[i],id=`CELL-${String(i+1).padStart(3,'0')}`;if(b.id!==id||b.cellRole!=='EXECUTIVE_AGENT'||b.cellGovernanceContract!=='CELL-EXEC-GOV-001'||b.executionMode!=='ASSIGNED_SCOPE_ONLY'||!b.performanceProfile) failures.push('BOT_BINDING_'+id);}
const p20=protocols.protocols?.find(p=>p.id==='P20'),p21=protocols.protocols?.find(p=>p.id==='P21');
if(p20?.absorbedPolicyId!=='CELL-EXEC-GOV-001'||p21?.absorbedPolicyId!=='CELL-EXEC-GOV-001') failures.push('PROTOCOL_ABSORPTION');
if(p20?.canonicalPolicy!=='docs/agents/CELL-EXECUTIVE-OPERATING-POLICY.md'||p21?.canonicalPolicy!=='docs/agents/CELL-EXECUTIVE-OPERATING-POLICY.md') failures.push('POLICY_BINDING');
if(cooperation?.cellExecutiveGovernance?.contractId!=='CELL-EXEC-GOV-001'||cooperation?.cellExecutiveGovernance?.status!=='MANDATORY') failures.push('COOPERATION_BINDING');
for(const marker of ['CELL-EXEC-GOV-001','MASTER-1','MASTER-2','MASTER-3','REPAIR LANE','DEVELOPMENT & LEARNING LANE','L0','L7']) if(!policy.includes(marker)) failures.push('POLICY_'+marker);
if(failures.length){console.error('CELL_EXECUTIVE_GOVERNANCE_TEST=FAIL');for(const f of failures)console.error('FAIL='+f);process.exit(1);}
console.log('CELL_EXECUTIVE_GOVERNANCE_TEST=PASS');
console.log('BOT_COUNT=PASS');
console.log('RANKING=PASS');
console.log('ESCALATION=PASS');
console.log('PARALLEL_LANES=PASS');
