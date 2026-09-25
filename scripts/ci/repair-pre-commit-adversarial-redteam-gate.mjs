#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const SHA=String(process.env.FLIXO_EXPECTED_TARGET_SHA??'').trim();
const OUTPUT=String(process.env.FLIXO_PRE_COMMIT_ADVERSARIAL_REDTEAM_OUTPUT??'/tmp/flixo-pre-commit-adversarial-redteam.json');
const BOTS=['SECURITY-REDTEAM-1','SECURITY-REDTEAM-2','SECURITY-REDTEAM-3'];
const WORKFLOW=path.join(ROOT,'.github','workflows','auto-repair.yml');
const die=m=>{throw new Error('PRE_COMMIT_ADVERSARIAL_REDTEAM='+m)};
const git=(args,cwd=ROOT)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const validateWorkflow=source=>{
  if(!source.includes('Pre-commit adversarial + Red Team gate'))throw new Error('PRE_COMMIT_GATE_WIRING_MISSING');
  if(!source.includes('repair-pre-commit-adversarial-redteam-gate.mjs'))throw new Error('PRE_COMMIT_GATE_SCRIPT_MISSING');
  if(!/steps\.pre_commit_adversarial_redteam\.outcome == 'success'/.test(source))throw new Error('COMMIT_GATE_DEPENDENCY_MISSING');
  const a=source.indexOf('Pre-commit adversarial + Red Team gate'), b=source.indexOf('Create exact unpublished candidate commit');
  if(a<0||b<=a)throw new Error('PRE_COMMIT_GATE_ORDER_INVALID');
};
if(process.argv.includes('--validate-only')){validateWorkflow(fs.readFileSync(WORKFLOW,'utf8'));console.log('PRE_COMMIT_WORKFLOW_VALIDATION=PASS');process.exit(0)}
if(!/^[0-9a-f]{40}$/.test(SHA))die('EXACT_SHA_REQUIRED');
if(git(['rev-parse','HEAD'])!==SHA)die('TARGET_SHA_MISMATCH');
if(!git(['diff','--cached','--name-only']))die('STAGED_PATCH_REQUIRED');
validateWorkflow(fs.readFileSync(WORKFLOW,'utf8'));

const patch=execFileSync('git',['diff','--cached','--binary'],{cwd:ROOT,encoding:'utf8'});
const stagedFiles=git(['diff','--cached','--name-only']).split(/\r?\n/).filter(Boolean);
const pf=path.join(os.tmpdir(),'flixo-precommit-'+process.pid+'.patch');
const wt=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-precommit-wt-'));
fs.writeFileSync(pf,patch);
const rootHead=git(['rev-parse','HEAD']);
const rootIndex=patch;
const cleanup=()=>{try{run('git',['worktree','remove','--force',wt],ROOT)}catch(error){void error};try{fs.rmSync(pf,{force:true})}catch(error){void error}};
process.on('exit',cleanup);
run('git',['worktree','add','--detach',wt,SHA],ROOT);
if(git(['rev-parse','HEAD'],wt)!==SHA)die('TEMP_SHA_MISMATCH');

const red=(label,cwd)=>{
  const reports=[];
  for(const bot of BOTS){
    const out=path.join(os.tmpdir(),'flixo-'+label+'-'+bot+'.json');
    run(process.execPath,['scripts/security/security-red-team-runner.mjs','--bot='+bot,'--sha='+SHA,'--output='+out],cwd);
    if(!fs.existsSync(out))die('RED_TEAM_EVIDENCE_MISSING:'+label+':'+bot);
    const r=JSON.parse(fs.readFileSync(out,'utf8'));
    if(r.targetSha!==SHA||r.authority!=='READ_ONLY_SECURITY_DISCOVERY'||r.mutationAuthority!==false||r.certificationAuthority!==false)die('RED_TEAM_AUTHORITY_BREACH:'+label+':'+bot);
    reports.push(r);
  }
  return reports;
};
const baseline=red('baseline',wt);
run('git',['apply','--whitespace=nowarn',pf],wt);
run('git',['add','-A'],wt);
if(git(['rev-parse','HEAD'],wt)!==SHA)die('PATCH_MOVED_HEAD');
const patched=red('patched',wt);
const key=f=>[f.botId,f.ruleId,f.file,f.title].join('|');
const baselineKeys=new Set(baseline.flatMap(r=>(r.findings??[]).map(key)));
const fresh=patched.flatMap(r=>(r.findings??[]).filter(f=>!baselineKeys.has(key(f))));
if(fresh.length)die('NEW_RED_TEAM_FINDINGS:'+JSON.stringify(fresh).slice(0,6000));
for(const file of stagedFiles.filter(f=>/\.(?:mjs|cjs|js)$/iu.test(f))){const target=path.join(wt,file);if(fs.existsSync(target))run(process.execPath,['--check',target],wt)}

const kill=(name,mutate)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-mut-'+name+'-'));
 try{
  run('git',['worktree','add','--detach',dir,SHA],ROOT); run('git',['apply','--whitespace=nowarn',pf],dir);
  mutate(path.join(dir,'.github','workflows','auto-repair.yml'));
  try{run(process.execPath,[path.join(dir,'scripts','ci','repair-pre-commit-adversarial-redteam-gate.mjs'),'--validate-only'],dir);die('ADVERSARIAL_MUTATION_SURVIVED:'+name)}
  catch(e){if(String(e?.message??e).includes('ADVERSARIAL_MUTATION_SURVIVED'))throw e}
  return {name,status:'KILLED'};
 }finally{try{run('git',['worktree','remove','--force',dir],ROOT)}catch(error){void error}}
};
const mutations=[
 kill('BYPASS_GATE_CONDITION',p=>{const s=fs.readFileSync(p,'utf8').replace("steps.pre_commit_adversarial_redteam.outcome == 'success'","steps.pre_commit_adversarial_redteam.outcome != 'success'");fs.writeFileSync(p,s)}),
 kill('REMOVE_GATE_REFERENCE',p=>{const s=fs.readFileSync(p,'utf8').replaceAll('repair-pre-commit-adversarial-redteam-gate.mjs','removed-gate.mjs');fs.writeFileSync(p,s)}),
 kill('MOVE_COMMIT_BEFORE_GATE',p=>{
   const s=fs.readFileSync(p,'utf8'), gs=s.indexOf('      - name: Pre-commit adversarial + Red Team gate'), ge=s.indexOf('\n      - name:',gs+1), cs=s.indexOf('      - name: Create exact unpublished candidate commit');
   if(gs<0||ge<0||cs<0)throw new Error('MUTATION_SETUP_FAILED');
   const gateBlock=s.slice(gs,ge); const without=s.slice(0,gs)+s.slice(ge); const c2=without.indexOf('      - name: Create exact unpublished candidate commit'); const cend=without.indexOf('\n      - name:',c2+1);
   fs.writeFileSync(p,without.slice(0,cend)+'\n'+gateBlock+without.slice(cend));
 })
];
if(git(['rev-parse','HEAD'])!==rootHead)die('ROOT_HEAD_CHANGED');
if(execFileSync('git',['diff','--cached','--binary'],{cwd:ROOT,encoding:'utf8'})!==rootIndex)die('ROOT_INDEX_CHANGED');
const report={protocol:'FLIXO-PRE-COMMIT-ADVERSARIAL-REDTEAM-v1',expectedSha:SHA,commitCreated:false,baselineRedTeam:{pass:true,bots:BOTS},patchedRedTeam:{pass:true,bots:BOTS,newFindingCount:0},adversarial:{pass:mutations.every(x=>x.status==='KILLED'),mutations},authority:{mutationAuthority:false,certificationAuthority:false,commitAuthority:false},status:'PASS'};
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
