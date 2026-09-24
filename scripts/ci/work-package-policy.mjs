#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
const root=process.cwd(); const env=(n,d='')=>String(process.env[n]??d).trim();
const base=env('FLIXO_WP_BASE_SHA',process.argv[2]??''); const head=env('FLIXO_WP_HEAD_SHA',process.argv[3]??'HEAD');
if(!/^[0-9a-f]{40}$/.test(base)) throw new Error('WORK_PACKAGE_BASE_SHA_REQUIRED');
const run=a=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const rows=run(['log','--format=%H%x09%aI%x09%s','--reverse',`${base}..${head}`]).split('\n').filter(Boolean).map(x=>{const [sha,date,subject]=x.split('\t');return{sha,time:Date.parse(date),subject};});
const windowMs=Number(env('FLIXO_WP_BURST_WINDOW_MINUTES','5'))*60000;
const threshold=Number(env('FLIXO_WP_BURST_THRESHOLD','8'));
const bursts=[]; let b=[];
for(const row of rows){if(!b.length||row.time-b[b.length-1].time<=windowMs)b.push(row);else{if(b.length>=threshold)bursts.push(b);b=[row];}}
if(b.length>=threshold)bursts.push(b);
const markerSingle=/(?:\[WP:(WP-[A-Za-z0-9][A-Za-z0-9._-]*)\]|(?<![A-Za-z0-9._-])(WP-[A-Za-z0-9][A-Za-z0-9._-]*)(?![A-Za-z0-9._-]))/;
const markerGlobal=/(?:\[WP:(WP-[A-Za-z0-9][A-Za-z0-9._-]*)\]|(?<![A-Za-z0-9._-])(WP-[A-Za-z0-9][A-Za-z0-9._-]*)(?![A-Za-z0-9._-]))/g;
const extractWorkPackages=subject=>[...String(subject).matchAll(markerGlobal)].map(m=>m[1]||m[2]).filter(Boolean);
const burstWorkPackages=burst=>[...new Set(burst.flatMap(c=>extractWorkPackages(c.subject)))];
const bad=bursts.filter(x=>burstWorkPackages(x).length!==1);
const out={schemaVersion:1,policy:'ONE_WORK_PACKAGE_PER_REPAIR_BURST',baseSha:base,headSha:head,commitCount:rows.length,burstThreshold:threshold,burstCount:bursts.length,bursts:bursts.map(x=>({count:x.length,firstSha:x[0].sha,lastSha:x.at(-1).sha,workPackageIds:burstWorkPackages(x),allTagged:x.every(c=>markerSingle.test(c.subject))})),violations:bad.length,status:bad.length?'FAIL':'PASS'};
console.log(JSON.stringify(out,null,2));
if(bad.length)throw new Error('WORK_PACKAGE_BURST_REQUIRES_EXACTLY_ONE_WP_TAG');
