import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('docs/agents/error-learning-log/manifest.json','utf8'));
const index=JSON.parse(fs.readFileSync('docs/agents/error-learning-log/index.json','utf8'));
const historicalIndexPath='docs/agents/historical-action-errors/index.json';
const historicalRecordsDir='docs/agents/historical-action-errors/records';
const historicalIndex=fs.existsSync(historicalIndexPath)
  ? JSON.parse(fs.readFileSync(historicalIndexPath,'utf8'))
  : null;

function readShard(file){
  return fs.readFileSync(file,'utf8').split(/\r?\n/u).filter(Boolean).map((line)=>JSON.parse(line));
}

export function retrieveTeachingRecords({className=null,stage=null,limit=12}={}){
  const normalizedClass=className?String(className).trim():null;
  const normalizedStage=stage?String(stage).trim():null;
  const files=normalizedClass && index.classes[normalizedClass]
    ? index.classes[normalizedClass]
    : manifest.shards.slice(0,Math.min(manifest.shardCount,3)).map((item)=>item.path);
  const records=[];
  for(const file of files){
    for(const record of readShard(file)){
      if(normalizedClass && record.class!==normalizedClass) continue;
      if(normalizedStage && record.stage!==normalizedStage) continue;
      records.push(record);
      if(records.length>=limit) return records;
    }
  }
  return records;
}


export function retrieveHistoricalActionErrors({term=null,limit=12}={}){
  if(!historicalIndex || !term) return [];
  const q=String(term).trim();
  const ids=[...(historicalIndex.byFingerprint?.[q]??[]),...(historicalIndex.byNormalized?.[q]??[])];
  const exact=[...new Set(ids)].map((id)=>{
    try{return JSON.parse(fs.readFileSync(`${historicalRecordsDir}/${id}.json`,'utf8'));}catch{return null;}
  }).filter(Boolean);
  if(exact.length) return exact.slice(0,limit);
  const needle=q.toLowerCase();
  const candidates=Object.values(historicalIndex.byNormalized??{}).flat().filter((id)=>typeof id==='string').map((id)=>{
    try{return JSON.parse(fs.readFileSync(`${historicalRecordsDir}/${id}.json`,'utf8'));}catch{return null;}
  }).filter(Boolean);
  return candidates.filter((r)=>String(r.normalized??'').toLowerCase().includes(needle)).slice(0,limit);
}

export function logContract(){
  return {
    totalRecords:manifest.totalRecords,
    totalLines:manifest.totalLines,
    source:manifest.source,
    authority:manifest.authority,
    exactShaRequired:manifest.exactShaRequired,
    shardCount:manifest.shardCount,
    historicalActionErrorIndex: historicalIndex
      ? {
          source: historicalIndex.source,
          authority: historicalIndex.authority,
          recordCount: historicalIndex.recordCount,
          indexed: true,
        }
      : { indexed: false }
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [className,stage]=process.argv.slice(2);
  const result=retrieveTeachingRecords({className:className||null,stage:stage||null,limit:12});
  process.stdout.write(JSON.stringify({contract:logContract(),count:result.length,records:result},null,2));
}
