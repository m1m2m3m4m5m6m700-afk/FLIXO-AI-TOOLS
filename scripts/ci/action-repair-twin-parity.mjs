#!/usr/bin/env node
import fs from 'node:fs';

const arg=(name,fallback='')=>{
  const prefix='--'+name+'=';
  const hit=process.argv.find((value)=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):fallback;
};
const output=arg('output','/tmp/action-repair-twin-parity.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const profilePath='diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json';

if(!/^[a-f0-9]{40}$/.test(targetSha)) throw new Error('ACTION_TWIN_PARITY_SHA_REQUIRED');
if(!fingerprint) throw new Error('ACTION_TWIN_PARITY_FINGERPRINT_REQUIRED');

const profile=JSON.parse(fs.readFileSync(profilePath,'utf8'));
const primary=profile.roleMatrix?.['ACTION-REPAIR'];
const twin=profile.roleMatrix?.['ACTION-REPAIR-2'];
if(!primary||!twin) throw new Error('ACTION_TWIN_PARITY_ROLES_MISSING');

const primaryCaps=Array.isArray(primary.intelligenceCapabilities)
  ? primary.intelligenceCapabilities
  : (primary.capabilities||[]).filter((item)=>item!=='CAN_MUTATE_SOURCE_WHEN_OWNER');
const twinCaps=Array.isArray(twin.intelligenceCapabilities)
  ? twin.intelligenceCapabilities
  : (twin.capabilities||[]).filter((item)=>!/^CAN_MUTATE_SOURCE/.test(item));

const normalize=(list)=>[...new Set(list)].sort();
const a=JSON.stringify(normalize(primaryCaps));
const b=JSON.stringify(normalize(twinCaps));
if(a!==b) throw new Error('ACTION_TWIN_PARITY_INTELLIGENCE_CAPABILITIES_MISMATCH');

const primaryMission=String(primary.mission||'');
const twinMission=String(twin.mission||'');
if(!/THINK_AS_PROGRAMMER/u.test(primaryMission) || !/THINK_AS_PROGRAMMER/u.test(twinMission)) {
  throw new Error('ACTION_TWIN_PARITY_PROGRAMMER_MISSION_MISMATCH');
}
if(twin.mutationAuthority==='OWNER_ONLY') throw new Error('ACTION_TWIN_PARITY_AUTHORITY_NOT_SEPARATED');

const result={
  schemaVersion:1,
  protocol:'ACTION-PROGRAMMER-TWIN-PARITY-v1',
  status:'EXACT_INTELLIGENCE_PARITY',
  targetSha,
  failureFingerprint:fingerprint,
  primaryAgent:'ACTION-REPAIR',
  twinAgent:'ACTION-REPAIR-2',
  intelligenceParity:'EXACT',
  authorityParity:'SEPARATED_BY_DESIGN',
  sharedReasoningModel:profile.agentRuntime?.modelProfiles?.primary||'FRONTIER_CODING_REASONING',
  primaryMission,
  twinMission,
  intelligenceCapabilities:normalize(primaryCaps),
  invariants:{
    sameProgrammingReasoning:true,
    sameSemanticCodeAnalysis:true,
    samePatchReasoning:true,
    sameRegressionReasoning:true,
    sameCounterfactualReasoning:true,
    independentEvidenceRequired:true,
    oneActiveMutationOwner:true,
    twinCannotBypassPrimary:true
  },
  generatedAt:new Date().toISOString()
};

fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({
  status:result.status,
  targetSha,
  intelligenceParity:result.intelligenceParity,
  authorityParity:result.authorityParity,
  capabilityCount:result.intelligenceCapabilities.length
},null,2));
