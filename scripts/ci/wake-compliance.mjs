#!/usr/bin/env node
import fs from 'node:fs';

const inputPath=process.argv[2] ?? '/tmp/flixo-watch/wake-runs.json';
const outputPath=process.argv[3] ?? '/tmp/flixo-watch/wake-compliance.json';
const raw=fs.readFileSync(inputPath,'utf8');
const parsed=JSON.parse(raw);
const runs=Array.isArray(parsed) ? parsed : (parsed.workflow_runs ?? []);
const expectedMs=5*60*1000;
const graceMs=2*60*1000;
const maxGapMs=expectedMs+graceMs;

const scheduleRuns=runs
  .filter((r)=>r?.event==='schedule' && (r.status==='completed' || r.status==='in_progress'))
  .map((r)=>({
    id:Number(r.id ?? r.databaseId ?? 0),
    status:r.status ?? null,
    conclusion:r.conclusion ?? null,
    startedAt:r.runStartedAt ?? r.createdAt ?? null,
    createdAt:r.createdAt ?? null,
    updatedAt:r.updatedAt ?? null,
    headSha:r.headSha ?? null,
  }))
  .filter((r)=>Number.isFinite(Date.parse(String(r.startedAt ?? ''))))
  .sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt));

const gaps=[];
for(let i=1;i<scheduleRuns.length;i++){
  const previous=Date.parse(scheduleRuns[i-1].startedAt);
  const current=Date.parse(scheduleRuns[i].startedAt);
  const gapMs=current-previous;
  if(gapMs>maxGapMs){
    gaps.push({
      previousRunId:scheduleRuns[i-1].id,
      currentRunId:scheduleRuns[i].id,
      previousStartedAt:scheduleRuns[i-1].startedAt,
      currentStartedAt:scheduleRuns[i].startedAt,
      gapMs,
      gapMinutes:Number((gapMs/60000).toFixed(3)),
      allowedMinutes:Number((maxGapMs/60000).toFixed(3)),
    });
  }
}

const latest=scheduleRuns.at(-1) ?? null;
const now=Date.now();
const latestAgeMs=latest ? Math.max(0,now-Date.parse(latest.startedAt)) : null;
const latestStale=latest ? latestAgeMs>maxGapMs : true;
const sampleState=scheduleRuns.length<2 ? 'BASELINE_REQUIRED' : gaps.length===0 && !latestStale ? 'PASS' : 'WAKE_GAP_RED';

const report={
  schemaVersion:1,
  protocol:'FLIXO-WAKE-COMPLIANCE-v1',
  expectedEveryMs:expectedMs,
  graceMs,
  maxAllowedGapMs:maxGapMs,
  sampleCount:scheduleRuns.length,
  latest,
  latestAgeMs,
  latestAgeMinutes:latestAgeMs===null?null:Number((latestAgeMs/60000).toFixed(3)),
  gaps,
  status:sampleState,
  exactScheduleRequired:'*/5 * * * *',
  action:sampleState==='WAKE_GAP_RED'?'OPEN_WAKE_GAP_AND_RECOVER':'CONTINUE_OBSERVATION',
};

fs.mkdirSync(new URL('.',new URL('file://'+outputPath)).pathname,{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(sampleState==='WAKE_GAP_RED') process.exit(2);
