#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildRepairEngineeringPlan, executeRepairEngineering } from './action-repair-engineering.mjs';

export const MASTER_REPAIR_ENGINE_PROTOCOL = 'FLIXO-MASTER-REPAIR-ENGINE-v2';
export const MASTER_REPAIR_ENGINE_VERSION = 'MASTER-REPAIR-ENGINE-v2';
const SHA_RE = /^[a-f0-9]{40}$/u;
const FP_RE = /^[a-f0-9]{64}$/u;
const ROOT = process.cwd();

const arg = (name, fallback='') => {
  const prefix='--'+name+'=';
  const hit=process.argv.find(v=>v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};
const sha256 = value => crypto.createHash('sha256').update(String(value),'utf8').digest('hex');
const normalize = value => path.normalize(String(value ?? '')).replaceAll('\\','/');
const git = (cwd,args) => execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim();
const exactSha = value => SHA_RE.test(String(value));
const ignored = new Set(['.git','node_modules','dist','coverage','.cache','.vite']);
const exts = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.yml','.yaml','.md']);

export function assertExactExecutionHead(repoRoot=ROOT,targetSha) {
  if(!exactSha(targetSha)) throw new Error('MASTER_REPAIR_TARGET_SHA_INVALID');
  if(git(repoRoot,['branch','--show-current'])!=='execution') throw new Error('MASTER_REPAIR_BRANCH_MUST_BE_EXECUTION');
  const currentSha=git(repoRoot,['rev-parse','HEAD']);
  if(currentSha!==targetSha) throw new Error('MASTER_REPAIR_STALE_SHA:'+targetSha+':current='+currentSha);
  return {branch:'execution',currentSha};
}

const inside=(repoRoot,file)=>{
  const rel=normalize(file);
  if(!rel || rel.startsWith('../') || path.isAbsolute(String(file))) throw new Error('MASTER_REPAIR_PATH_OUTSIDE_REPOSITORY='+file);
  const absolute=path.resolve(repoRoot,rel);
  const root=path.resolve(repoRoot)+path.sep;
  if(absolute!==path.resolve(repoRoot) && !absolute.startsWith(root)) throw new Error('MASTER_REPAIR_PATH_ESCAPE='+file);
  return {relative:rel,absolute};
};

const protectedPath=file=>{
  const p=normalize(file);
  return p==='.git'||p.startsWith('.git/')||p.startsWith('node_modules/')||p.startsWith('dist/')||p.startsWith('coverage/')||
    p.startsWith('tests/')||p.startsWith('__tests__/')||/(^|\/)test[^/]*\.(?:js|jsx|ts|tsx|mjs|cjs)$/u.test(p)||
    /(?:^|\/).*\.(?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs)$/u.test(p);
};
const controlPlane=new Set([
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/repair-control-plane.mjs',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/repair-protocol.mjs',
  'scripts/ci/execution-mutation-gate.mjs'
]);
const weakensGate=content=>/continue-on-error\s*:\s*(?:true|\$\{\{\s*true)|force\s*:\s*true|\|\|\s*true|exit\s+0\b/iu.test(String(content));
const allowed=(file,patterns)=>patterns.some(raw=>{
  const p=normalize(raw), f=normalize(file);
  if(p.endsWith('/**')) { const base=p.slice(0,-3).replace(/\/$/u,''); return f===base||f.startsWith(base+'/'); }
  if(p.endsWith('*')) return f.startsWith(p.slice(0,-1));
  return f===p;
});

const walk=(repoRoot,relative='')=>{
  const current=path.join(repoRoot,relative);
  if(!fs.existsSync(current)) return [];
  const out=[];
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
    if(entry.isDirectory() && ignored.has(entry.name)) continue;
    const rel=normalize(path.join(relative,entry.name));
    if(entry.isDirectory()) out.push(...walk(repoRoot,rel));
    else if(exts.has(path.extname(entry.name).toLowerCase())) out.push(rel);
  }
  return out;
};

export function readRepositoryFile({repoRoot=ROOT,targetSha,file}) {
  assertExactExecutionHead(repoRoot,targetSha);
  const r=inside(repoRoot,file);
  if(!fs.existsSync(r.absolute)||!fs.statSync(r.absolute).isFile()) throw new Error('MASTER_REPAIR_FILE_MISSING='+r.relative);
  const content=fs.readFileSync(r.absolute,'utf8');
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,operation:'READ_FILE',path:r.relative,targetSha,bytes:Buffer.byteLength(content,'utf8'),lines:content?content.split(/\r?\n/u).length:0,sha256:sha256(content),content};
}

export function scanRepository({repoRoot=ROOT,targetSha,maxFiles=5000}) {
  assertExactExecutionHead(repoRoot,targetSha);
  const files=walk(repoRoot).slice(0,maxFiles);
  const records=files.map(file=>{
    const content=fs.readFileSync(path.join(repoRoot,file),'utf8');
    return {path:file,bytes:Buffer.byteLength(content,'utf8'),lines:content?content.split(/\r?\n/u).length:0,sha256:sha256(content),extension:path.extname(file).toLowerCase()};
  });
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,operation:'REPOSITORY_SCAN',targetSha,fileCount:records.length,truncated:walk(repoRoot).length>maxFiles,files:records,digest:sha256(JSON.stringify(records))};
}

const importTarget=(repoRoot,from,spec)=>{
  if(!String(spec).startsWith('.')) return null;
  const base=path.resolve(path.dirname(path.join(repoRoot,from)),spec);
  for(const candidate of [base,base+'.js',base+'.mjs',base+'.cjs',base+'.ts',base+'.tsx',base+'.jsx',path.join(base,'index.js'),path.join(base,'index.mjs'),path.join(base,'index.ts')]){
    const rel=normalize(path.relative(repoRoot,candidate));
    if(fs.existsSync(candidate)&&!rel.startsWith('../')) return rel;
  }
  return null;
};

export function buildRepositoryGraph({repoRoot=ROOT,targetSha,files=null}) {
  const source=files ?? scanRepository({repoRoot,targetSha}).files.map(x=>x.path);
  const nodes=new Map(source.map(file=>[file,{path:file,imports:[],importedBy:[] }]));
  for(const file of source){
    const abs=path.join(repoRoot,file);
    if(!fs.existsSync(abs)) continue;
    const text=fs.readFileSync(abs,'utf8');
    const specs=[];
    for(const re of [
      /\bimport\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/gu,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu
    ]) for(const m of text.matchAll(re)) specs.push(m[1]);
    for(const target of [...new Set(specs.map(s=>importTarget(repoRoot,file,s)).filter(Boolean))]){
      if(!nodes.has(target)) nodes.set(target,{path:target,imports:[],importedBy:[]});
      nodes.get(file).imports.push(target);
      nodes.get(target).importedBy.push(file);
    }
  }
  const graph=[...nodes.values()].map(n=>({path:n.path,imports:[...new Set(n.imports)].sort(),importedBy:[...new Set(n.importedBy)].sort()})).sort((a,b)=>a.path.localeCompare(b.path));
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,operation:'REPOSITORY_INTELLIGENCE_GRAPH',targetSha,nodeCount:graph.length,edgeCount:graph.reduce((n,x)=>n+x.imports.length,0),nodes:graph};
}

export function buildDependencyImpact({repoRoot=ROOT,targetSha,changedPaths=[]}) {
  const graph=buildRepositoryGraph({repoRoot,targetSha});
  const changed=new Set(changedPaths.map(normalize));
  const direct=graph.nodes.filter(n=>n.imports.some(x=>changed.has(x))&&!changed.has(n.path)).map(n=>n.path);
  const seen=new Set(direct), queue=[...direct];
  while(queue.length){
    const file=queue.shift();
    const node=graph.nodes.find(n=>n.path===file);
    for(const parent of node?.importedBy??[]) if(!changed.has(parent)&&!seen.has(parent)){seen.add(parent);queue.push(parent);}
  }
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,operation:'DEPENDENCY_BLAST_RADIUS',targetSha,changedPaths:[...changed].sort(),directConsumers:[...new Set(direct)].sort(),transitiveConsumers:[...seen].filter(x=>!direct.includes(x)).sort(),blastRadius:{changedFiles:changed.size,directConsumers:direct.length,transitiveConsumers:Math.max(0,seen.size-direct.length)}};
}

export function buildNoRepairDecision({targetSha,currentSha,taskId,fingerprint,runId,failureText='',evidence={}}={}) {
  const reasons=[];
  if(!taskId) reasons.push('MISSING_TASK_ID');
  if(!FP_RE.test(String(fingerprint))) reasons.push('MISSING_OR_INVALID_FAILURE_FINGERPRINT');
  if(!exactSha(targetSha)||targetSha!==currentSha) reasons.push('STALE_OR_INVALID_SHA');
  if(!runId) reasons.push('MISSING_RUN_ID');
  if(evidence.currentFailureLog!==true) reasons.push('CURRENT_FAILURE_EVIDENCE_MISSING');
  const text=String(failureText).toLowerCase();
  if(/stale\s+(?:run|token|lease)|head\s+changed|invalidated\s+(?:run|token|lease)/.test(text)) reasons.push('STALE_RUNTIME_SIGNAL');
  if(/permission denied|forbidden|authorization.*missing|cannot access repository/.test(text)) reasons.push('AUTHORITY_OR_ACCESS_BLOCKER');
  if(/rate limit|model not supported|sessionmodelerror|network unavailable|provider unavailable|vercel.*limit/.test(text)) reasons.push('EXTERNAL_PROVIDER_BLOCKER');
  if(/secret (?:exposed|leaked)|credential.*leak|token.*leak/.test(text)) reasons.push('SECURITY_SENSITIVE_BLOCKER');
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,decision:reasons.length?'NO_REPAIR':'REPAIR_ALLOWED',repairable:reasons.length===0,reasons:[...new Set(reasons)],targetSha,currentSha,taskId:taskId??null,failureFingerprint:fingerprint??null,runId:runId??null};
}

const snapshot= (repoRoot,file)=>{
  const r=inside(repoRoot,file);
  if(!fs.existsSync(r.absolute)) return {path:r.relative,existed:false,content:null,mode:null};
  const stat=fs.statSync(r.absolute);
  if(!stat.isFile()) throw new Error('MASTER_REPAIR_TARGET_NOT_FILE='+r.relative);
  return {path:r.relative,existed:true,content:fs.readFileSync(r.absolute,'utf8'),mode:stat.mode&0o777};
};
const restore=(repoRoot,snaps)=>{
  for(const s of snaps.slice().reverse()){
    const r=inside(repoRoot,s.path);
    if(!s.existed){if(fs.existsSync(r.absolute)) fs.rmSync(r.absolute,{force:true});continue;}
    fs.mkdirSync(path.dirname(r.absolute),{recursive:true});
    fs.writeFileSync(r.absolute,s.content,'utf8');
    if(s.mode!=null) fs.chmodSync(r.absolute,s.mode);
  }
};
const atomic=(absolute,content)=>{
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  const temp=absolute+'.master-repair-'+process.pid;
  fs.writeFileSync(temp,content,'utf8');
  fs.renameSync(temp,absolute);
};
const diffStats=repoRoot=>{
  const names=git(repoRoot,['diff','--name-only']).split(/\r?\n/u).filter(Boolean).map(normalize);
  let additions=0,deletions=0;
  for(const row of git(repoRoot,['diff','--numstat']).split(/\r?\n/u).filter(Boolean)){
    const p=row.split(/\s+/u); additions+=Number(p[0])||0; deletions+=Number(p[1])||0;
  }
  return {names:[...new Set(names)].sort(),additions,deletions,changedLines:additions+deletions};
};
const runCheck=(repoRoot,check)=>{
  if(Array.isArray(check)) return execFileSync(String(check[0]),(check[1]??[]).map(String),{cwd:repoRoot,encoding:'utf8',timeout:300000});
  const v=String(check).trim();
  if(v==='npm run typecheck') return execFileSync('npm',['run','typecheck'],{cwd:repoRoot,encoding:'utf8',timeout:300000});
  if(v==='npm run lint') return execFileSync('npm',['run','lint'],{cwd:repoRoot,encoding:'utf8',timeout:300000});
  if(v==='npm run build') return execFileSync('npm',['run','build'],{cwd:repoRoot,encoding:'utf8',timeout:300000});
  if(/^npm run test:[A-Za-z0-9:_-]+$/u.test(v)) return execFileSync('npm',['run',v.slice(8)],{cwd:repoRoot,encoding:'utf8',timeout:300000});
  if(/^node --check (?:scripts|diagnostics|src)\//u.test(v)) return execFileSync('node',['--check',v.slice('node --check '.length)],{cwd:repoRoot,encoding:'utf8',timeout:120000});
  throw new Error('MASTER_REPAIR_CHECK_NOT_ALLOWLISTED='+v);
};

const assertWriteScope=({repoRoot,file,allowedPaths,allowCreate})=>{
  const r=inside(repoRoot,file);
  if(!allowed(r.relative,allowedPaths)) throw new Error('MASTER_REPAIR_WRITE_SCOPE_DENIED='+r.relative);
  if(protectedPath(r.relative)) throw new Error('MASTER_REPAIR_TEST_OR_PROTECTED_PATH='+r.relative);
  if(controlPlane.has(r.relative)) throw new Error('MASTER_REPAIR_CONTROL_PLANE_WRITE_FORBIDDEN='+r.relative);
  if(r.relative==='main'||r.relative.startsWith('main/')) throw new Error('MASTER_REPAIR_MAIN_WRITE_FORBIDDEN');
  if(!fs.existsSync(r.absolute)&&!allowCreate) throw new Error('MASTER_REPAIR_NEW_FILE_REQUIRES_ALLOW_CREATE='+r.relative);
  return r;
};

export function applyWriteTransaction({repoRoot=ROOT,plan}={}) {
  if(!plan||typeof plan!=='object') throw new Error('MASTER_REPAIR_PLAN_REQUIRED');
  const {taskId,fingerprint,runId,targetSha,allowedPaths=[],writes=[],checks=[],maxFiles=8,maxChangedLines=800}=plan;
  assertExactExecutionHead(repoRoot,targetSha);
  const decision=buildNoRepairDecision({targetSha,currentSha:targetSha,taskId,fingerprint,runId,failureText:plan.failureText??'',evidence:plan.evidence??{}});
  if(!decision.repairable) throw new Error('MASTER_REPAIR_NO_REPAIR='+decision.reasons.join(','));
  if(git(repoRoot,['status','--porcelain'])) throw new Error('MASTER_REPAIR_WRITE_REQUIRES_CLEAN_WORKTREE');
  if(!Array.isArray(writes)||!writes.length) throw new Error('MASTER_REPAIR_WRITES_REQUIRED');
  if(writes.length>maxFiles) throw new Error('MASTER_REPAIR_MAX_FILES_EXCEEDED');
  const declared=[...new Set(writes.map(x=>normalize(x?.path)).filter(Boolean))];
  const snaps=declared.map(file=>snapshot(repoRoot,file));
  const receipts=[];
  try{
    for(const item of writes){
      assertExactExecutionHead(repoRoot,targetSha);
      const r=assertWriteScope({repoRoot,file:item.path,allowedPaths,allowCreate:item.allowCreate===true});
      const before=fs.existsSync(r.absolute)?fs.readFileSync(r.absolute,'utf8'):'';
      let after;
      if(item.kind==='replace'){
        const search=String(item.search??''), replacement=String(item.replace??'');
        if(!search) throw new Error('MASTER_REPAIR_EMPTY_SEARCH='+r.relative);
        const matches=before.split(search).length-1;
        if(!item.replaceAll&&matches!==1) throw new Error('MASTER_REPAIR_ANCHOR_MISMATCH='+r.relative+':'+matches);
        after=item.replaceAll?before.split(search).join(replacement):before.replace(search,replacement);
      } else after=String(item.content??'');
      if(after===before) throw new Error('MASTER_REPAIR_NOOP_WRITE='+r.relative);
      if(weakensGate(after)) throw new Error('MASTER_REPAIR_GATE_WEAKENING='+r.relative);
      atomic(r.absolute,after);
      receipts.push({path:r.relative,beforeSha256:sha256(before),afterSha256:sha256(after)});
      if(git(repoRoot,['rev-parse','HEAD'])!==targetSha) throw new Error('MASTER_REPAIR_HEAD_MOVED_DURING_TRANSACTION');
    }
    const stats=diffStats(repoRoot);
    const unexpected=stats.names.filter(file=>!declared.includes(file));
    if(unexpected.length) throw new Error('MASTER_REPAIR_UNDECLARED_CHANGED_PATHS='+unexpected.join(','));
    if(stats.names.length>maxFiles) throw new Error('MASTER_REPAIR_MAX_CHANGED_FILES_EXCEEDED');
    if(stats.changedLines>maxChangedLines) throw new Error('MASTER_REPAIR_MAX_CHANGED_LINES_EXCEEDED');
    git(repoRoot,['diff','--check']);
    const checkResults=[];
    for(const check of checks){
      try{const output=runCheck(repoRoot,check);checkResults.push({check,status:'PASS',outputDigest:sha256(output)});}
      catch(error){checkResults.push({check,status:'FAIL',error:String(error?.stderr??error?.message??error).slice(-6000)});throw new Error('MASTER_REPAIR_POST_WRITE_CHECK_FAILED='+String(check));}
      assertExactExecutionHead(repoRoot,targetSha);
    }
    return {
      schemaVersion:2,protocol:MASTER_REPAIR_ENGINE_PROTOCOL,engineVersion:MASTER_REPAIR_ENGINE_VERSION,
      status:'WRITTEN_PENDING_CANONICAL_GREEN',mutationApplied:true,canonicalGreen:false,certificationAuthority:false,
      mutationAuthority:'MASTER_REPAIR_BOUNDED_EXECUTION',targetSha,currentSha:git(repoRoot,['rev-parse','HEAD']),
      taskId,failureFingerprint:fingerprint,runId,changedPaths:stats.names,diff:stats,writes:receipts,checks:checkResults,
      rollbackOnFailure:true,noMainMutation:true,noTestMutation:true,noControlPlaneMutation:true,generatedAt:new Date().toISOString()
    };
  }catch(error){restore(repoRoot,snaps);throw error;}
}

export function buildMasterRepairPlan({repoRoot=ROOT,targetSha,taskId,fingerprint,runId,failureText='',changedPaths=[],evidence={},candidates=[]}={}) {
  assertExactExecutionHead(repoRoot,targetSha);
  const scan=scanRepository({repoRoot,targetSha});
  const graph=buildRepositoryGraph({repoRoot,targetSha,files:scan.files.map(x=>x.path)});
  const impact=changedPaths.length?buildDependencyImpact({repoRoot,targetSha,changedPaths}):null;
  const decision=buildNoRepairDecision({targetSha,currentSha:targetSha,taskId,fingerprint,runId,failureText,evidence});
  const engineering=buildRepairEngineeringPlan({taskId,fingerprint,targetSha,candidates});
  return {protocol:MASTER_REPAIR_ENGINE_PROTOCOL,engineVersion:MASTER_REPAIR_ENGINE_VERSION,identity:{taskId,failureFingerprint:fingerprint,targetSha,runId},decision,repository:{scan,graph,impact},engineering,capabilities:{read:true,repositoryGraph:true,dependencyImpact:true,candidateSimulation:true,boundedWrite:decision.repairable,rollback:true,canonicalGreen:false,certification:false}};
}

if(import.meta.url==='file://'+process.argv[1]){
  const command=arg('command',process.argv[2]||'plan');
  const targetSha=arg('sha',process.env.FLIXO_TARGET_SHA);
  const taskId=arg('task',process.env.FLIXO_TASK_ID);
  const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT);
  const runId=arg('run-id',process.env.TARGET_RUN_ID||process.env.GITHUB_RUN_ID);
  const output=arg('output','/tmp/flixo-master-repair-engine.json');
  let result;
  if(command==='read') result=readRepositoryFile({repoRoot:ROOT,targetSha,file:arg('path')});
  else if(command==='scan') result=scanRepository({repoRoot:ROOT,targetSha});
  else if(command==='graph') result=buildRepositoryGraph({repoRoot:ROOT,targetSha});
  else if(command==='impact') result=buildDependencyImpact({repoRoot:ROOT,targetSha,changedPaths:arg('paths').split(',').map(normalize).filter(Boolean)});
  else if(command==='plan'){
    const candidatesPath=arg('candidates');
    const candidates=candidatesPath?JSON.parse(fs.readFileSync(candidatesPath,'utf8')):[];
    result=buildMasterRepairPlan({repoRoot:ROOT,targetSha,taskId,fingerprint,runId,failureText:arg('failure-text',process.env.FLIXO_FAILURE_TEXT||''),evidence:{currentFailureLog:Boolean(process.env.FLIXO_FAILURE_LOG)||Boolean(arg('failure-log'))},candidates:Array.isArray(candidates)?candidates:[]});
  } else if(command==='simulate'){
    const candidates=JSON.parse(fs.readFileSync(arg('candidates'),'utf8'));
    result=executeRepairEngineering({repoRoot:ROOT,taskId,fingerprint,targetSha,candidates});
  } else if(command==='write'){
    result=applyWriteTransaction({repoRoot:ROOT,plan:JSON.parse(fs.readFileSync(arg('plan'),'utf8'))});
  } else throw new Error('MASTER_REPAIR_UNKNOWN_COMMAND='+command);
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({protocol:result.protocol,command,status:result.status||result.decision?.decision||'PASS',targetSha:result.targetSha||result.identity?.targetSha||targetSha,changedPaths:result.changedPaths||[],output},null,2));
}
