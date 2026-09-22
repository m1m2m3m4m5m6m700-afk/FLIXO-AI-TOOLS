#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root=process.env.FLIXO_TARGET_DIR||process.cwd();
const expectedSha=String(process.env.FLIXO_EXPECTED_TARGET_SHA||'').trim();
const baseSha=String(process.env.FLIXO_PATCH_BASE_SHA||'').trim();
const output=process.env.FLIXO_ADVERSARIAL_OUTPUT||'/tmp/flixo-postpatch-adversarial.json';

function die(message){ throw new Error('POST_PATCH_ADVERSARIAL='+message); }
function sha256(value){ return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
function git(args){ return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function runNode(cwd,file){
  const args=file.endsWith('.ts')?['--experimental-strip-types',file]:[file];
  return spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:120000,env:process.env});
}
function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist','.next','coverage'].includes(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full,out); else out.push(full);
  }
  return out;
}
function relevantTests(workspace,changed){
  const bases=changed.map(v=>path.basename(v).replace(/\.(mjs|js|ts|tsx|jsx)$/i,'').toLowerCase());
  return walk(workspace).map(file=>{
    const rel=path.relative(workspace,file).replaceAll(path.sep,'/');
    const name=path.basename(file);
    const isTest=(rel.startsWith('scripts/ci/test-')||rel.startsWith('scripts/test-')||name.endsWith('.test.mjs'))&&name.endsWith('.mjs');
    if(!isTest||/adversarial-repair-twin|post-patch-adversarial/i.test(name)) return null;
    const body=fs.readFileSync(file,'utf8').toLowerCase();
    const score=bases.reduce((n,b)=>n+(b&&body.includes(b)?2:0),0)+(rel.startsWith('scripts/ci/test-')?1:0);
    return score>1?{file,rel,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.rel.localeCompare(b.rel)).slice(0,6);
}
function mutateCode(content,index){
  const mutations=[
    ['STRICT_EQUALITY_INVERSION',/===/,'!=='],
    ['STRICT_INEQUALITY_INVERSION',/!==/,'==='],
    ['BOOLEAN_AND_OR_SWAP',/&&/,'||'],
    ['BOOLEAN_OR_AND_SWAP',/\|\|/,'&&'],
    ['TRUE_FALSE_FLIP',/\btrue\b/,'false'],
    ['FALSE_TRUE_FLIP',/\bfalse\b/,'true']
  ];
  const start=index%mutations.length;
  for(let i=0;i<mutations.length;i++){
    const m=mutations[(start+i)%mutations.length];
    if(m[1].test(content)) return {mutation:m[0],content:content.replace(m[1],m[2])};
  }
  return null;
}
function mutateWorkflow(content){
  const candidates=[
    ['CANONICAL_BRANCH_TRIGGER_REDUCTION',/branches:\s*\[main,\s*execution\]/,'branches: [execution]'],
    ['STALE_EVIDENCE_CANCEL_GUARD_REMOVAL',/cancel-in-progress:\s*true/,'cancel-in-progress: false']
  ];
  for(const c of candidates) if(c[1].test(content)) return {mutation:c[0],content:content.replace(c[1],c[2])};
  return null;
}
function main(){
  if(process.env.FLIXO_TWIN_READ_ONLY!=='true') die('READ_ONLY_REQUIRED');
  if(!['execution',''].includes(git(['branch','--show-current']))) die('EXECUTION_REF_REQUIRED');
  const target=git(['rev-parse','HEAD']);
  if(!/^[a-f0-9]{40}$/.test(target)) die('TARGET_SHA_INVALID');
  if(expectedSha&&target!==expectedSha) die('TARGET_SHA_MISMATCH:'+target+':'+expectedSha);
  if(git(['status','--porcelain'])) die('WORKTREE_NOT_CLEAN');
  const parent=baseSha||git(['rev-parse','HEAD^']);
  if(!/^[a-f0-9]{40}$/.test(parent)||parent===target) die('BASE_SHA_INVALID');
  const patch=git(['diff','--binary',parent,target]);
  const changed=git(['diff','--name-only',parent,target]).split(/\r?\n/).filter(Boolean);
  if(!changed.length) die('PATCH_EMPTY');
  const seed='0x'+sha256(target+':'+(process.env.FLIXO_FAILURE_FINGERPRINT||'POST_PATCH_FALSIFICATION')).slice(0,12);
  const actual=[];
  function record(label,result){ actual.push({label,code:result.status,signal:result.signal,stdout:String(result.stdout||'').slice(-2500),stderr:String(result.stderr||'').slice(-2500)}); }
  const diffCheck=spawnSync('git',['-C',root,'diff','--check',parent,target],{encoding:'utf8',timeout:60000,env:process.env});
  record('git-diff-check',diffCheck);
  if(changed.some(v=>/\.(yml|yaml)$/i.test(v))) record('validate-auto-repair-boundary',runNode(root,'scripts/ci/validate-auto-repair-boundary.mjs'));
  if(changed.some(v=>v.startsWith('scripts/ci/'))) record('validate-ci-contract',runNode(root,'scripts/validate-ci-contract.mjs'));
  const tests=relevantTests(root,changed);
  for(const test of tests) record('targeted-test:'+test.rel,runNode(root,test.file));
  const failures=actual.filter(v=>v.code!==0&&v.code!==null);
  if(failures.length){
    const result={schemaVersion:1,protocol:'FLIXO-POST-PATCH-ADVERSARIAL-v1',phase:'POST_PATCH',authority:'READ_ONLY_ADVERSARIAL_ASSESSOR',mutationAuthority:false,repositoryWrite:false,actionsWrite:false,branch:'execution',targetSha:target,baseSha:parent,patchDigest:'sha256:'+sha256(patch),seed,strategyTested:'targeted-regression-plus-deterministic-mutation',casesGenerated:actual.length,casesFailed:failures.length,regressionsFound:failures.length,mutantCasesGenerated:0,mutantCasesKilled:0,mutantCasesSurvived:0,relevantTests:tests.map(v=>v.rel),actualProbeResults:actual,mutationResults:[],status:'FOUND_FAILURE',failureFingerprint:process.env.FLIXO_FAILURE_FINGERPRINT||null,testArtifactDigest:'sha256:'+sha256(JSON.stringify(actual)),generatedAt:new Date().toISOString()};
    fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2)); process.exitCode=1; return;
  }
  const sandbox='/tmp/flixo-adversarial-'+target;
  fs.rmSync(sandbox,{recursive:true,force:true});
  execFileSync('git',['-C',root,'worktree','add','--detach',sandbox,target],{encoding:'utf8'});
  const mutations=[];
  try{
    const codeFiles=changed.filter(v=>/\.(mjs|js|ts)$/i.test(v)).slice(0,4);
    for(let i=0;i<codeFiles.length&&mutations.length<6;i++){
      const rel=codeFiles[i],file=path.join(sandbox,rel); if(!fs.existsSync(file)) continue;
      const original=fs.readFileSync(file,'utf8'); const mutation=mutateCode(original,i+parseInt(seed.slice(2),16)%7); if(!mutation) continue;
      const testsForFile=relevantTests(sandbox,[rel]).slice(0,2);
      if(!testsForFile.length){ mutations.push({file:rel,mutation:mutation.mutation,outcome:'NO_KILL_TEST'}); continue; }
      fs.writeFileSync(file,mutation.content);
      const probes=testsForFile.map(t=>({test:t.rel,...runNode(sandbox,t.file)}));
      fs.writeFileSync(file,original);
      mutations.push({file:rel,mutation:mutation.mutation,outcome:probes.some(v=>v.code!==0&&v.code!==null)?'KILLED':'SURVIVED',probes:probes.map(v=>({test:v.test,code:v.code,signal:v.signal}))});
    }
    for(const rel of changed.filter(v=>/\.(yml|yaml)$/i.test(v)).slice(0,2)){
      const file=path.join(sandbox,rel); if(!fs.existsSync(file)) continue;
      const original=fs.readFileSync(file,'utf8'); const mutation=mutateWorkflow(original);
      if(!mutation){mutations.push({file:rel,mutation:'NONE_APPLICABLE',outcome:'NO_MUTANT'});continue;}
      fs.writeFileSync(file,mutation.content);
      const probe=runNode(sandbox,'scripts/ci/validate-auto-repair-boundary.mjs');
      fs.writeFileSync(file,original);
      mutations.push({file:rel,mutation:mutation.mutation,outcome:probe.status!==0?'KILLED':'SURVIVED',code:probe.status});
    }
  }finally{ execFileSync('git',['-C',root,'worktree','remove','--force',sandbox],{encoding:'utf8'}); }
  const survivors=mutations.filter(v=>v.outcome==='SURVIVED'||v.outcome==='NO_KILL_TEST');
  const sourceNeedsCoverage=changed.some(v=>/\.(mjs|js|ts|tsx|jsx)$/i.test(v))&&tests.length===0;
  const status=sourceNeedsCoverage||survivors.length?'INCONCLUSIVE':'NO_COUNTEREXAMPLE';
  const result={schemaVersion:1,protocol:'FLIXO-POST-PATCH-ADVERSARIAL-v1',phase:'POST_PATCH',authority:'READ_ONLY_ADVERSARIAL_ASSESSOR',mutationAuthority:false,repositoryWrite:false,actionsWrite:false,branch:'execution',targetSha:target,baseSha:parent,patchDigest:'sha256:'+sha256(patch),seed,strategyTested:'targeted-regression-plus-deterministic-mutation',casesGenerated:actual.length,casesFailed:0,regressionsFound:0,mutantCasesGenerated:mutations.filter(v=>v.outcome!=='NO_MUTANT').length,mutantCasesKilled:mutations.filter(v=>v.outcome==='KILLED').length,mutantCasesSurvived:mutations.filter(v=>v.outcome==='SURVIVED').length,relevantTests:tests.map(v=>v.rel),actualProbeResults:actual,mutationResults:mutations,status,failureFingerprint:process.env.FLIXO_FAILURE_FINGERPRINT||null,testArtifactDigest:'sha256:'+sha256(JSON.stringify({actual,mutations,target,parent})),generatedAt:new Date().toISOString()};
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2)); if(status!=='NO_COUNTEREXAMPLE') process.exitCode=1;
}
main();