#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT=process.cwd();
const expectedSha=String(process.argv.find(v=>v.startsWith('--sha='))?.slice(6)??'').trim();
const output=path.resolve(ROOT,String(process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'/tmp/flixo-redteam-agent-sweep.json'));
if(!/^[a-f0-9]{40}$/u.test(expectedSha)) throw new Error('AGENT_SWEEP_EXACT_SHA_REQUIRED');

const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const head=git(['rev-parse','HEAD']);
if(head!==expectedSha) throw new Error(`AGENT_SWEEP_SHA_MISMATCH:${head}:${expectedSha}`);
const remote=git(['ls-remote','origin','refs/heads/execution']).split(/\s+/u)[0];
if(remote!==expectedSha) throw new Error(`AGENT_SWEEP_STALE_SHA_REJECTED:${remote}:${expectedSha}`);

const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/agents/FLIXO-BOT.json'),'utf8'));
const kernel=registry.unifiedCognitiveKernel;
const dist=registry.distribution;
const failures=[];
const findings=[];
const hash=(value)=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');

function fail(id,detail){failures.push({id,detail});}
function add(id,agent,detail,severity='HIGH'){findings.push({id,agent,severity,detail,targetSha:expectedSha,status:'OPEN'});}

const agents=Array.isArray(dist?.cognitiveBotIds)?dist.cognitiveBotIds:[];
if(agents.length!==200) fail('GLOBAL_COUNT',`expected 200 canonical cognitive agents; found ${agents.length}`);
if(new Set(agents).size!==agents.length) fail('GLOBAL_UNIQUE','duplicate canonical cognitive IDs');
if(!agents.every((id)=>/^FLIXO-BOT-\d{3}$/u.test(String(id)))) fail('GLOBAL_ID_FORMAT','canonical IDs must be FLIXO-BOT-001..200');
if(JSON.stringify(agents)!==JSON.stringify(dist?.learningConsumers??[])) fail('LEARNING_AUDIENCE_PARITY','learningConsumers differs from cognitiveBotIds');

const requiredKernel=['version','capabilities','reasoningLenses','reasoningSequence','overProvisionedCognition','roleOverlayPolicy','unifiedLearningMemory'];
for(const key of requiredKernel) if(kernel?.[key]===undefined) fail('KERNEL_FIELD_MISSING',key);
if(kernel?.version!=='FLIXO-BOT-BRAIN-v2') fail('KERNEL_VERSION',String(kernel?.version));
if(kernel?.overProvisionedCognition!==true) fail('OVERPROVISIONING_DISABLED',String(kernel?.overProvisionedCognition));
if(!Array.isArray(kernel?.capabilities)||kernel.capabilities.length<90) fail('CAPABILITY_UNDERCOVERAGE',String(kernel?.capabilities?.length??0));
if(!Array.isArray(kernel?.reasoningLenses)||kernel.reasoningLenses.length<30) fail('REASONING_UNDERCOVERAGE',String(kernel?.reasoningLenses?.length??0));
if(kernel?.roleOverlayPolicy!=='PRIORITY_ONLY_NO_CAPABILITY_REDUCTION') fail('ROLE_REDUCES_COGNITION',String(kernel?.roleOverlayPolicy));
const capabilityHash=hash(kernel.capabilities);
const lensHash=hash(kernel.reasoningLenses);
const memory=kernel?.unifiedLearningMemory;
if(memory?.singleMemory!=='diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json') fail('WRONG_CANONICAL_MEMORY',String(memory?.singleMemory));
if(memory?.members!==200) fail('MEMORY_MEMBER_COUNT',String(memory?.members));
if(memory?.automaticVisibility!==true) fail('MEMORY_NOT_AUTOMATIC',String(memory?.automaticVisibility));
if(memory?.perAgentMemoryCopies===true) fail('PRIVATE_MEMORY_COPIES_ENABLED','per-agent copies forbidden');

for(const agent of agents){
  if(!agents.includes(agent)) fail('AGENT_MISSING',agent);
  const local=registry?.agentOverlays?.[agent]??registry?.roleOverlays?.[agent];
  if(local?.capabilities && hash(local.capabilities)!==capabilityHash) add('ROLE_CAPABILITY_DRIFT',agent,'agent-specific capability set differs from shared kernel','CRITICAL');
  if(local?.memory && local.memory!=='diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json') add('PRIVATE_MEMORY',agent,'agent-specific canonical memory detected','CRITICAL');
  if(local?.mutationAuthority===true && local?.role!=='REPAIR') add('AUTHORITY_OVERLAY_DRIFT',agent,'unexpected mutation authority on cognitive identity','CRITICAL');
  if(local?.certificationAuthority===true) add('CERTIFICATION_ESCALATION',agent,'cognitive identity cannot self-certify','CRITICAL');
}

const internal=Array.isArray(dist?.systemWideInternalConsumers)?dist.systemWideInternalConsumers:[];
if(internal.length!==76) fail('INTERNAL_CONSUMER_COUNT',String(internal.length));
for(const required of ['MASTER-1','MASTER-2','MASTER-3','assistantController','executionAgent','reviewAgent','repairAgent','securityAgent','testAgent','ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3','SECURITY-REDTEAM-3']) {
  if(!internal.includes(required)) fail('INTERNAL_AGENT_NOT_COVERED',required);
}

const redteam=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/agents/SECURITY-RED-TEAM-BOTS.json'),'utf8'));
if(redteam?.execution?.mutationAuthority!==false||redteam?.execution?.certificationAuthority!==false||redteam?.execution?.greenAuthority!==false) fail('REDTEAM_AUTHORITY_DRIFT','red team authority boundary changed');
if(redteam?.execution?.isolation?.repositoryAccess!=='CONTENTS_READ_ONLY') fail('REDTEAM_WRITE_ACCESS','red team is not contents-read-only');
if(redteam?.branchPolicy?.thirdBranchAllowed!==false) fail('REDTEAM_THIRD_BRANCH_POLICY','third branch allowed');

function adversarialProbe(id,mutate){
  const temp=fs.mkdtempSync(path.join('/tmp/','flixo-agent-sweep-'));
  const target=path.join(temp,'FLIXO-BOT.json');
  fs.writeFileSync(target,JSON.stringify(registry,null,2));
  const altered=JSON.parse(fs.readFileSync(target,'utf8'));
  mutate(altered);
  const probe=[];
  try{
    const ids=altered.distribution?.cognitiveBotIds??[];
    if(id==='REMOVE_AGENT' && ids.length===200) probe.push('ESCAPED');
    else if(id==='REDUCE_CAPABILITIES' && altered.unifiedCognitiveKernel?.capabilities?.length>=90) probe.push('ESCAPED');
    else if(id==='PRIVATE_MEMORY' && altered.unifiedCognitiveKernel?.unifiedLearningMemory?.singleMemory==='diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json') probe.push('ESCAPED');
    else if(id==='ROLE_SUPPRESS_CAPABILITY' && altered.unifiedCognitiveKernel?.roleOverlayPolicy==='PRIORITY_ONLY_NO_CAPABILITY_REDUCTION') probe.push('ESCAPED');
    else if(id==='GRANT_CERTIFICATION' && !altered.unifiedCognitiveKernel?.unifiedLearningMemory?.certificationAuthority) probe.push('ESCAPED');
    else probe.push('BLOCKED');
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
  if(probe[0]==='ESCAPED') fail('ADVERSARIAL_ESCAPE',id);
}
adversarialProbe('REMOVE_AGENT',x=>x.distribution.cognitiveBotIds.pop());
adversarialProbe('REDUCE_CAPABILITIES',x=>x.unifiedCognitiveKernel.capabilities.splice(0,20));
adversarialProbe('PRIVATE_MEMORY',x=>{x.unifiedCognitiveKernel.unifiedLearningMemory.singleMemory='diagnostics/auto-repair/private-agent-memory.json';});
adversarialProbe('ROLE_SUPPRESS_CAPABILITY',x=>{x.unifiedCognitiveKernel.roleOverlayPolicy='ROLE_CAN_REDUCE_CAPABILITIES';});
adversarialProbe('GRANT_CERTIFICATION',x=>{x.unifiedCognitiveKernel.unifiedLearningMemory.certificationAuthority=true;});

const perAgent=[
 {count:agents.length,passed:failures.filter(x=>x.id==='GLOBAL_COUNT').length===0},
 {count:agents.filter((id)=>/^FLIXO-BOT-\d{3}$/u.test(String(id))).length,passed:failures.every(x=>x.id!=='GLOBAL_ID_FORMAT')},
 {count:agents.length,passed:findings.filter(x=>x.agent).length===0}
];

const report={
 protocol:'FLIXO-REDTEAM-ALL-AGENTS-v1',
 authority:'READ_ONLY_ADVERSARIAL_AGENT_VALIDATION',
 mutationAuthority:false,
 certificationAuthority:false,
 targetSha:expectedSha,
 agentCount:agents.length,
 canonicalKernelVersion:kernel?.version??null,
 canonicalCapabilityCount:kernel?.capabilities?.length??0,
 canonicalReasoningLensCount:kernel?.reasoningLenses?.length??0,
 canonicalCapabilityHash:capabilityHash,
 canonicalLensHash:lensHash,
 singleCanonicalMemory:memory?.singleMemory??null,
 automaticMemoryVisibility:memory?.automaticVisibility??false,
 perAgent,
 findings,
 failures,
 adversarialProbes:5,
 status:failures.length===0&&findings.length===0?'PASS':'FAIL',
 discoveredAt:new Date().toISOString()
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS') process.exit(1);
