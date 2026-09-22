#!/usr/bin/env node
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';

const root=process.env.FLIXO_TARGET_DIR||process.cwd();
const expectedSha=String(process.env.FLIXO_EXPECTED_TARGET_SHA||'').trim();
const parentSha=String(process.env.FLIXO_PATCH_BASE_SHA||'').trim();
const assessorOutput=process.env.FLIXO_ADVERSARIAL_OUTPUT||'/tmp/flixo-postpatch-adversarial.json';
const aggregateOutput=process.env.FLIXO_PARALLEL_VERIFICATION_OUTPUT||'/tmp/flixo-candidate-verification.json';
const controller=process.env.FLIXO_REPAIR_CONTROLLER||'/tmp/flixo-repair-controller';
const rcaManifestPath=process.env.FLIXO_RCA_MANIFEST_PATH||'/tmp/flixo-rca-manifest.json';
const fail=(message)=>{throw new Error('CANDIDATE_PARALLEL_VERIFICATION='+message);};

function spawnGroup(command,args,env,logFile){
  const child=spawn(command,args,{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});
  const chunks=[];
  child.stdout.on('data',d=>chunks.push(String(d)));
  child.stderr.on('data',d=>chunks.push(String(d)));
  const settled=new Promise(resolve=>{
    child.once('close',(code,signal)=>{const output=chunks.join('').slice(-12000);fs.writeFileSync(logFile,output);resolve({code,signal,output});});
    child.once('error',error=>{const output=[...chunks,String(error)].join('').slice(-12000);fs.writeFileSync(logFile,output);resolve({code:1,signal:null,output});});
  });
  return {child,settled};
}

function killGroup(child){
  if(!child?.pid) return;
  try{process.kill(-child.pid,'SIGTERM');}catch{ /* process may already have exited */ }
  setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{ /* process may already have exited */ }},3000).unref();
}

async function main(){
  if(!/^[a-f0-9]{40}$/i.test(expectedSha)) fail('EXPECTED_SHA_INVALID');
  if(!/^[a-f0-9]{40}$/i.test(parentSha)) fail('PARENT_SHA_INVALID');
  fs.mkdirSync('/tmp/flixo-parallel-verification',{recursive:true});
  const target=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(target!==expectedSha) fail('TARGET_SHA_MISMATCH:'+target+':'+expectedSha);
  if(execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'}).trim()) fail('WORKTREE_NOT_CLEAN');
  const env={...process.env,FLIXO_TARGET_DIR:root,FLIXO_EXPECTED_TARGET_SHA:expectedSha,FLIXO_PATCH_BASE_SHA:parentSha,FLIXO_RCA_MANIFEST_PATH:rcaManifestPath};
  const regressionCommand=[
    'set -euo pipefail',
    'node "$FLIXO_REPAIR_CONTROLLER/scripts/ci/ensure-agent-locales.mjs"',
    'node "$FLIXO_REPAIR_CONTROLLER/node_modules/typescript/bin/tsc" --noEmit',
    'node "$FLIXO_REPAIR_CONTROLLER/scripts/test.mjs" --mode=diagnose --gate=static',
    'node "$FLIXO_REPAIR_CONTROLLER/scripts/test.mjs" --mode=diagnose --gate=build',
    'git diff --check "$FLIXO_PATCH_BASE_SHA" "$FLIXO_EXPECTED_TARGET_SHA"'
  ].join(' && ');
  const regression=spawnGroup('bash',['-lc',regressionCommand],{...env,FLIXO_REPAIR_CONTROLLER:controller},'/tmp/flixo-parallel-verification/targeted-regression.log');
  const assessor=spawnGroup(process.execPath,['scripts/ci/post-patch-adversarial-assessor.mjs'],{...env,FLIXO_ADVERSARIAL_OUTPUT:assessorOutput,FLIXO_TWIN_READ_ONLY:'true',FLIXO_TWIN_DETACHED:'false'},'/tmp/flixo-parallel-verification/adversarial.log');
  let firstFailure=null;
  const outcomes={};
  await new Promise(resolve=>{
    let remaining=2;
    const settle=(name,value)=>{
      outcomes[name]=value;
      if(value.code!==0&&firstFailure===null){firstFailure=name;if(name==='adversarial')killGroup(regression.child);}
      remaining-=1;if(remaining===0)resolve();
    };
    regression.settled.then(v=>settle('targetedRegression',v));
    assessor.settled.then(v=>settle('adversarial',v));
  });
  let adversarial=null;
  if(fs.existsSync(assessorOutput)){try{adversarial=JSON.parse(fs.readFileSync(assessorOutput,'utf8'));}catch{ /* process may already have exited */ }}
  const bothPass=outcomes.targetedRegression?.code===0&&outcomes.adversarial?.code===0&&adversarial?.status==='NO_COUNTEREXAMPLE'&&adversarial?.falsifierVerdict==='PASS_CONFIRMED'&&adversarial?.finiteInvariantProof?.status==='PROVEN'&&adversarial?.passConfirmed===true;
  const aggregate={
    schemaVersion:1,protocol:'FLIXO-CANDIDATE-PARALLEL-VERIFICATION-v1',targetSha:expectedSha,parentSha,mode:'PARALLEL',earlyAbort:Boolean(firstFailure),firstFailure,
    gate:{targetedRegression:outcomes.targetedRegression?.code===0,adversarialNoCounterexample:outcomes.adversarial?.code===0&&adversarial?.status==='NO_COUNTEREXAMPLE'&&adversarial?.falsifierVerdict==='PASS_CONFIRMED'&&adversarial?.finiteInvariantProof?.status==='PROVEN',result:bothPass?'PASS':'FAIL'},
    targetedRegression:{code:outcomes.targetedRegression?.code??1,signal:outcomes.targetedRegression?.signal??null},
    adversarial:{code:outcomes.adversarial?.code??1,signal:outcomes.adversarial?.signal??null,status:adversarial?.status??(outcomes.adversarial?.code===0?'MISSING_EVIDENCE':'ABORTED'),targetSha:adversarial?.targetSha??null,falsifierVerdict:adversarial?.falsifierVerdict??null,passConfirmed:adversarial?.passConfirmed===true,convergenceDirective:adversarial?.convergenceDirective??null},
    generatedAt:new Date().toISOString()
  };
  fs.writeFileSync(aggregateOutput,JSON.stringify(aggregate,null,2)+'\n');
  console.log(JSON.stringify(aggregate,null,2));
  if(!bothPass) process.exitCode=1;
}
main().catch(error=>{console.error(String(error?.message??error));process.exitCode=1;});