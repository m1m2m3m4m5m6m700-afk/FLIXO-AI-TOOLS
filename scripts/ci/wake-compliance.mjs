import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const inputPath=process.argv[2] ?? '/tmp/flixo-watch/wake-runs.json';
const outputPath=process.argv[3] ?? '/tmp/flixo-watch/wake-compliance.json';
const nowArg=process.argv.find((v)=>v.startsWith('--now='))?.slice(6) ?? null;
const now=nowArg ? Date.parse(nowArg) : Date.now();
if(!Number.isFinite(now)) throw new Error('WAKE_COMPLIANCE_NOW_INVALID');

const normalizeRun=(r,eventOverride=null)=>({
  id:Number(r.id ?? r.databaseId ?? 0),
  status:r.status ?? null,
  conclusion:r.conclusion ?? null,
  event:eventOverride ?? r.event ?? null,
  startedAt:r.startedAt ?? r.runStartedAt ?? r.createdAt ?? null,
  createdAt:r.createdAt ?? null,
  updatedAt:r.updatedAt ?? null,
  headSha:r.headSha ?? null,
});

const loadInput=()=>JSON.parse(fs.readFileSync(inputPath,'utf8'));
const loadWatchdogSchedule=async()=>{
  const token=process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const repository=process.env.GITHUB_REPOSITORY;
  if(!token || !repository) return [];
  try {
    const raw=execFileSync('gh',['run','list','--repo',repository,'--workflow','execution-bot-watchdog.yml','--branch','main','--limit','50','--json','databaseId,status,conclusion,createdAt,updatedAt,startedAt,headSha,event'],{encoding:'utf8',env:{...process.env,GH_TOKEN:token}});
    const runs=JSON.parse(raw);
    return (Array.isArray(runs)?runs:[])
      .filter(r=>r.event==='schedule' || r.event==='workflow_run')
      .map(r=>normalizeRun(r,r.event==='schedule'?'watchdog-schedule':'watchdog-observer'));
  } catch(error) {
    throw new Error('WAKE_COMPLIANCE_WATCHDOG_FETCH_FAILED='+(error?.message??String(error)),{cause:error});
  }
}

const main=async()=>{
  const parsed=loadInput();
  const inputRuns=Array.isArray(parsed) ? parsed : (parsed.workflow_runs ?? []);
  const suppliedWatchdogRuns=Array.isArray(parsed?.watchdogRuns) ? parsed.watchdogRuns : [];
  const watchdogRuns=await loadWatchdogSchedule();
  const runs=[...inputRuns,...suppliedWatchdogRuns,...watchdogRuns];

  const expectedMs=5*60*1000;
  const graceMs=3*60*1000;
  const maxGapMs=expectedMs+graceMs;
  const scheduleRuns=runs
    .filter((r)=>(['schedule','workflow_dispatch'].includes(r?.event) || ['watchdog-schedule','watchdog-observer'].includes(r?.event)) && (r.status==='completed' || r.status==='in_progress'))
    .map(normalizeRun)
    .filter((r)=>Number.isFinite(Date.parse(String(r.startedAt ?? ''))))
    .sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt));

  const ROLLING_WINDOW_RUNS=12;
  const recentScheduleRuns=scheduleRuns.slice(-ROLLING_WINDOW_RUNS);
  const historicalSampleCount=Math.max(0,scheduleRuns.length-recentScheduleRuns.length);
  const gaps=[];
  for(let i=1;i<recentScheduleRuns.length;i++){
    const previous=Date.parse(recentScheduleRuns[i-1].startedAt);
    const current=Date.parse(recentScheduleRuns[i].startedAt);
    const gapMs=current-previous;
    if(gapMs>maxGapMs){
      gaps.push({
        previousRunId:recentScheduleRuns[i-1].id,
        currentRunId:recentScheduleRuns[i].id,
        previousStartedAt:recentScheduleRuns[i-1].startedAt,
        currentStartedAt:recentScheduleRuns[i].startedAt,
        gapMs,
        gapMinutes:Number((gapMs/60000).toFixed(3)),
        allowedMinutes:Number((maxGapMs/60000).toFixed(3)),
      });
    }
  }

  const latest=recentScheduleRuns.at(-1) ?? null;
  const previous=recentScheduleRuns.at(-2) ?? null;
  const latestAgeMs=latest ? Math.max(0,now-Date.parse(latest.startedAt)) : null;
  const latestStale=latest ? latestAgeMs>maxGapMs : true;
  const currentCadenceGapMs=latest && previous
    ? Math.max(0,Date.parse(latest.startedAt)-Date.parse(previous.startedAt))
    : null;
  const currentCadenceGapRed=currentCadenceGapMs===null ? false : currentCadenceGapMs>maxGapMs;
  const sampleState=scheduleRuns.length<2
    ? 'BASELINE_REQUIRED'
    : !latestStale && !currentCadenceGapRed
      ? 'PASS'
      : 'WAKE_GAP_RED';

  const report={
    schemaVersion:1,
    protocol:'FLIXO-WAKE-COMPLIANCE-v1',
    expectedEveryMs:expectedMs,
    graceMs,
    maxAllowedGapMs:maxGapMs,
    sampleCount:recentScheduleRuns.length,
    historicalSampleCount,
    rollingWindowRuns:ROLLING_WINDOW_RUNS,
    latest,
    latestAgeMs,
    latestAgeMinutes:latestAgeMs===null?null:Number((latestAgeMs/60000).toFixed(3)),
    currentCadenceGapMs,
    currentCadenceGapMinutes:currentCadenceGapMs===null?null:Number((currentCadenceGapMs/60000).toFixed(3)),
    currentCadenceGapRed,
    gaps,
    status:sampleState,
    exactScheduleRequired:'*/5 * * * *',
    wakeSources:['execution-bot-watchdog schedule','agent-repair-heartbeat dispatch'],
    watchdogRunsIncluded:watchdogRuns.length,
    action:sampleState==='WAKE_GAP_RED'?'OPEN_WAKE_GAP_AND_RECOVER':'CONTINUE_OBSERVATION',
  };

  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(sampleState==='WAKE_GAP_RED') process.exit(2);
};

await main();
