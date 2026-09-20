import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('docs/agents/error-learning-log/manifest.json','utf8'));
const index=JSON.parse(fs.readFileSync('docs/agents/error-learning-log/index.json','utf8'));

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

export function logContract(){
  return {
    totalRecords:manifest.totalRecords,
    totalLines:manifest.totalLines,
    source:manifest.source,
    authority:manifest.authority,
    exactShaRequired:manifest.exactShaRequired,
    shardCount:manifest.shardCount
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [className,stage]=process.argv.slice(2);
  const result=retrieveTeachingRecords({className:className||null,stage:stage||null,limit:12});
  process.stdout.write(JSON.stringify({contract:logContract(),count:result.length,records:result},null,2));
}
