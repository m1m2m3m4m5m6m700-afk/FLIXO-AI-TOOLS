#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SHA_RE=/^[a-f0-9]{40}$/u;
const arg=(name,fallback='')=>{
  const prefix='--'+name+'=';
  const value=process.argv.find((entry)=>entry.startsWith(prefix));
  return value===undefined?fallback:value.slice(prefix.length);
};
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const before=String(arg('before')).trim();
const after=String(arg('after')||git(['rev-parse','HEAD'])).trim();
const output=String(arg('output','')).trim();
const failures=[];
const checks=[];
const check=(name,ok,code,details={})=>{
  checks.push({name,status:ok?'PASS':'FAIL',code:ok?null:code,...details});
  if(!ok)failures.push(code);
};
check('sha.before',SHA_RE.test(before),'UNIFIED_PUSH_GATE_BEFORE_SHA_INVALID');
check('sha.after',SHA_RE.test(after),'UNIFIED_PUSH_GATE_AFTER_SHA_INVALID');
let count=null;
let parentCount=null;
let parent=null;
let message='';
if(SHA_RE.test(before)&&SHA_RE.test(after)){
  try{
    count=Number(git(['rev-list','--count',`${before}..${after}`]));
    check('push.commitCount',count===1,'UNIFIED_PUSH_GATE_COMMIT_COUNT_INVALID',{count});
  }catch(error){
    check('push.commitRange',false,'UNIFIED_PUSH_GATE_COMMIT_RANGE_UNAVAILABLE',{error:String(error?.message??error)});
  }
  try{
    const parents=git(['rev-list','--parents','-n','1',after]).split(/\s+/u).filter(Boolean);
    parentCount=Math.max(0,parents.length-1);
    parent=parents[1]??null;
    check('push.singleParent',parentCount===1,'UNIFIED_PUSH_GATE_PARENT_COUNT_INVALID',{parentCount});
    check('push.exactParent',parent===before,'UNIFIED_PUSH_GATE_PARENT_MISMATCH',{parent,before});
  }catch(error){
    check('push.parentRead',false,'UNIFIED_PUSH_GATE_PARENT_UNAVAILABLE',{error:String(error?.message??error)});
  }
  try{
    message=git(['show','-s','--format=%B',after]);
    check('manifest.marker',message.split(/\r?\n/u).some((line)=>line.trim()==='FLIXO-PUSH-GATE-v1'),'UNIFIED_PUSH_GATE_MARKER_MISSING');
    check('manifest.changeType',message.split(/\r?\n/u).some((line)=>line.trim()==='changeType=UNIFIED_ACCUMULATED_COMMIT'),'UNIFIED_PUSH_GATE_CHANGE_TYPE_INVALID');
    check('manifest.commitCount',message.split(/\r?\n/u).some((line)=>line.trim()==='commitCount=1'),'UNIFIED_PUSH_GATE_COMMIT_COUNT_TRAILER_MISSING');
    check('manifest.aggregateId',message.split(/\r?\n/u).some((line)=>/^aggregateId=[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(line.trim())),'UNIFIED_PUSH_GATE_AGGREGATE_ID_MISSING');
  }catch(error){
    check('manifest.read',false,'UNIFIED_PUSH_GATE_COMMIT_MESSAGE_UNAVAILABLE',{error:String(error?.message??error)});
  }
}
const report={
  schemaVersion:1,
  protocol:'FLIXO-UNIFIED-EXECUTION-PUSH-GATE-v1',
  phase:'EXECUTION_PUSH_EVENT',
  status:failures.length?'FAIL':'PASS',
  failClosed:true,
  before,
  after,
  commitCount:count,
  parent,
  parentCount,
  checks,
  failures:[...new Set(failures)],
  generatedAt:new Date().toISOString()
};
if(output){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
