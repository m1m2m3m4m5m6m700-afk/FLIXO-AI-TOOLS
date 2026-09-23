#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_LIVENESS_PROTOCOL, buildTeamPulseDirective } from './agent-liveness-protocol.mjs';

const IDS = AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds;
const RESIDENT_IDS = AGENT_LIVENESS_PROTOCOL.residentBotIds;
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback};
const sha=String(arg('sha',process.env.FLIXO_TARGET_SHA||'')).trim();
if(!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('FLIXO_TEAM_PULSE_EXACT_SHA_REQUIRED');
const minuteKey=arg('minute',new Date().toISOString().slice(0,16));
const runId=arg('run-id',process.env.GITHUB_RUN_ID||'LOCAL');
const activeOperation=arg('active-operation','false')==='true';
const activeWorker=arg('active-worker',process.env.FLIXO_ACTIVE_WORKER||'').trim() || null;
const output=arg('output','/tmp/flixo-team-pulse.json');
const pulse=buildTeamPulseDirective({targetSha:sha,taskId:'HEARTBEAT:'+runId,activeOperation,activeWorker,reason:'ONE_MINUTE_TEAM_HEARTBEAT:'+minuteKey});
const result={schemaVersion:2,protocol:'FLIXO-TEAM-PULSE-CONTROLLER-v2',minuteKey,runId,targetSha:sha,activeOperation,activeWorker,mode:activeOperation?'ACTIVE_OPERATION':'FULL_REPOSITORY_READ_ONLY_SCAN',pulseCount:1,pulses:[{...pulse,pulseId:'TEAM-'+minuteKey.replace(/[^0-9]/gu,'')+'-'+runId,pulseOrdinal:1,cadence:'EVERY_MINUTE',generatedAt:new Date().toISOString()}],allAgentsWakeCount:1,teamMemberCount:IDS.length,residentBotCount:RESIDENT_IDS.length,residentBotIds:[...RESIDENT_IDS],readOnlyWhenIdle:true,sourceMutationAllowed:false,onePulsePerHeartbeat:true};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',pulseCount:1,teamMemberCount:IDS.length,mode:result.mode,output},null,2));
if(process.argv[2]==='scan-plan'){
  // Scan mode is intentionally read-only over source code and repository metadata.
  const root=process.cwd();
  const skip=new Set(['.git','node_modules','.next','.vercel','dist','build','coverage','playwright-report','test-results']);
  const textExt=/\.(?:mjs|cjs|js|jsx|ts|tsx|css|scss|json|yml|yaml|md|mdx|txt)$/iu;
  const files=[];
  const counts={};
  const findings=[];
  const walk=(dir)=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(skip.has(entry.name)) continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) { walk(full); continue; }
      const rel=path.relative(root,full).replaceAll(path.sep,'/');
      files.push(rel);
      const ext=path.extname(rel).toLowerCase();
      counts[ext]=(counts[ext]||0)+1;
      if(!textExt.test(rel)) continue;
      const fileText=(() => { try { return fs.readFileSync(full,'utf8'); } catch { return null; } })();
      if(fileText === null) continue;
      if(/\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b/iu.test(fileText)) findings.push({type:'FOLLOW_UP_MARKER',path:rel});
      if(/continue-on-error:\s*true/iu.test(fileText)) findings.push({type:'CONTINUE_ON_ERROR',path:rel});
      if(/\|\|\s*true/iu.test(fileText)) findings.push({type:'MASKED_SUCCESS_PATTERN',path:rel});
      if(/git\s+push/iu.test(fileText) && /execution/iu.test(fileText)) findings.push({type:'EXECUTION_PUSH_PATH',path:rel});
    }
  };
  walk(root);
  const topLevel=[...new Set(files.map(f=>f.split('/')[0]))].sort();
  const sourceFiles=files.filter(f=>/^(src|api|scripts|config|schemas)\//u.test(f)).length;
  const workflowFiles=files.filter(f=>/^\.github\/workflows\//u.test(f)).length;
  const testFiles=files.filter(f=>/(^|\/)(test|tests|spec|__tests__)\//iu.test(f)||/(^|\/)(test|spec)[^/]*\.(?:mjs|js|ts)$/iu.test(f)).length;
  const plan=[
    'P0 — Governed execution and liveness: preserve execution→main, Exact-SHA, single publication authority, dynamic FLIXO10 ring, minute pulse and ALL_AGENTS wake.',
    'P1 — Canonical Test System: consolidate contract/static/build/browser/certification evidence, eliminate stale or duplicate authority, preserve false-green fail-closed behavior.',
    'P2 — Repair intelligence: unify RCA, historical Action Vault, adversarial ring, task ownership, push-seat custody, lessons and anti-lessons under one exact-SHA evidence chain.',
    'P3 — FLIXO AI assistant: improve intent understanding, clarification, tool selection, multi-step image-edit execution, conversational context and result verification.',
    'P4 — Image platform scale: expand canonical tool definitions, capability registry, shared loaders, filter architecture and artifact contracts without duplicating routing/SEO/i18n/test ownership.',
    'P5 — Product UX: refine mobile-first visual editor, assistant workspace, tool discovery, preview/undo/history, accessibility and localization while preserving the existing shell.',
    'P6 — Security/reliability: harden control-plane boundaries, permissions, secrets, runtime upload/CORS/cookie/postMessage surfaces, dependency/build integrity and deployment contracts.',
    'P7 — Performance/observability: establish deterministic performance budgets, error telemetry, browser/runtime diagnostics, cache strategy and actionable SLO evidence.',
    'P8 — Continuous evolution: regression replay, benchmark suites, learning promotion, plan refresh and evidence-based roadmap updates.',
  ];
  const planText=[
    '# FLIXO BOT — AUTONOMOUS FULL-REPOSITORY DEVELOPMENT PLAN',
    '',
    'MODE: READ_ONLY_SWEEP_WHEN_NO_ACTIVE_OPERATION',
    'AUTHORITY: FLIXO-BOT-BRAIN-v1 / CANONICAL CONTROL PLANE',
    'SOURCE_SHA: '+sha,
    'GENERATED_AT: '+new Date().toISOString(),
    '',
    '## Repository inventory',
    '- Resident logical bots: '+RESIDENT_IDS.length,
    '- Source/code/config candidates: '+sourceFiles,
    '- Workflow files: '+workflowFiles,
    '- Test files: '+testFiles,
    '- Top-level areas: '+topLevel.join(', '),
    '- Extension distribution: '+Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>(k||'[no-ext]')+':'+v).join(', '),
    '- Read-only findings: '+findings.length,
    '',
    '## Development roadmap',
    ...plan.flatMap((item)=>[item]),
    '',
    '## Current scan findings requiring review',
    ...(findings.slice(0,80).map((f)=>'- '+f.type+': '+f.path)),
    findings.length>80?'- … '+(findings.length-80)+' additional findings recorded in the sweep artifact.':[],
    '',
    '## Execution rule',
    'This plan is advisory until a canonical task is admitted through the task ledger. No idle sweep may mutate application source, tests, workflows, main, or protected control-plane state.',
    '',
  ].join('\n');
  const planOut=arg('plan-output','/tmp/flixo-full-repository-development-plan.md');
  fs.writeFileSync(planOut,planText);
  const jsonOut=arg('scan-output','/tmp/flixo-full-repository-readonly-scan.json');
  fs.writeFileSync(jsonOut,JSON.stringify({schemaVersion:1,protocol:'FLIXO10-FULL-REPOSITORY-READONLY-SWEEP-v1',targetSha:sha,readOnly:true,residentBotCount:RESIDENT_IDS.length,residentBotIds:[...RESIDENT_IDS],fileCount:files.length,sourceFiles,workflowFiles,testFiles,topLevel,counts,findings,planOutput:planOut,generatedAt:new Date().toISOString()},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',mode:'FULL_REPOSITORY_READ_ONLY_SCAN',filesScanned:files.length,findings:findings.length,planOutput:planOut,scanOutput:jsonOut},null,2));
}
