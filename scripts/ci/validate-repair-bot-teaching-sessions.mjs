#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DIR=path.join(ROOT,'docs','agents','teaching-sessions');
const ranges=[
  [1,2500,'REPAIR-BOT-TEACHING-01-02500.md'],
  [2501,5000,'REPAIR-BOT-TEACHING-02501-05000.md'],
  [5001,7500,'REPAIR-BOT-TEACHING-05001-07500.md'],
  [7501,10000,'REPAIR-BOT-TEACHING-07501-10000.md'],
  [10001,12500,'REPAIR-BOT-TEACHING-10001-12500.md'],
  [12501,15000,'REPAIR-BOT-TEACHING-12501-15000.md'],
  [15001,17500,'REPAIR-BOT-TEACHING-15001-17500.md'],
  [17501,20000,'REPAIR-BOT-TEACHING-17501-20000.md'],
];

const failures=[];
const lessons=[];
for(const [min,max,file] of ranges){
  const full=path.join(DIR,file);
  if(!fs.existsSync(full)){failures.push('MISSING_SHARD='+file);continue;}
  const text=fs.readFileSync(full,'utf8');
  const lines=text.split(/\r?\n/u).filter((line)=>/^\d+\.\s/u.test(line));
  if(lines.length!==max-min+1) failures.push('SHARD_COUNT='+file);
  const nums=lines.map((line)=>Number(line.match(/^(\d+)\./u)[1]));
  for(let i=0;i<nums.length;i++){
    const expected=min+i;
    if(nums[i]!==expected){failures.push('SHARD_SEQUENCE='+file+':'+nums[i]+':expected='+expected);break;}
  }
  for(const line of lines){
    if(!/\[Grounded (?:topic|curriculum):/u.test(line)) failures.push('GROUNDING_MISSING='+line.slice(0,80));
    lessons.push(line);
  }
}

const ids=lessons.map((line)=>Number(line.match(/^(\d+)\./u)[1]));
const advice=lessons.map((line)=>line.replace(/^\d+\.\s*/u,'').trim());
if(lessons.length!==20000) failures.push('TOTAL_LESSONS='+lessons.length);
if(ids.length!==new Set(ids).size) failures.push('DUPLICATE_IDS');
for(let i=1;i<=20000;i++) if(ids[i-1]!==i){failures.push('GLOBAL_GAP_AT='+i);break;}
if(advice.length!==new Set(advice).size) failures.push('DUPLICATE_ADVICE_TEXT');

const result={
  schemaVersion:1,
  protocol:'FLIXO-REPAIR-BOT-TEACHING-20K-v1',
  status:failures.length===0?'PASS':'BLOCK',
  targetLessonCount:20000,
  observedLessonCount:lessons.length,
  minId:ids.length?Math.min(...ids):null,
  maxId:ids.length?Math.max(...ids):null,
  duplicateIds:ids.length-new Set(ids).size,
  duplicateAdviceText:advice.length-new Set(advice).size,
  shardCount:ranges.length,
  failures,
  generatedAt:new Date().toISOString(),
};

console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
