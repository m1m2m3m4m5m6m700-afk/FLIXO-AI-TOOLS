import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest=JSON.parse(fs.readFileSync('docs/agents/error-learning-log/manifest.json','utf8'));
assert.equal(manifest.totalRecords,50000);
assert.equal(manifest.totalLines,50000);
assert.equal(manifest.shardCount,25);
assert.equal(manifest.recordsPerShard,2000);
assert.equal(manifest.source,'synthetic-teaching-record');
assert.equal(manifest.authority,'guidance-only');
assert.equal(manifest.exactShaRequired,true);

let total=0;
let previous=0;
const ids=new Set();
for(const shard of manifest.shards){
  const lines=fs.readFileSync(shard.path,'utf8').split(/\r?\n/u).filter(Boolean);
  assert.equal(lines.length,2000,shard.path);
  for(const line of lines){
    const record=JSON.parse(line);
    assert.match(record.id,/^EL\d{5}$/u);
    const n=Number(record.id.slice(2));
    assert.equal(n,previous+1);
    assert.equal(record.source,'synthetic-teaching-record');
    assert.equal(record.authority,'guidance-only');
    assert.equal(record.exactSha,true);
    ids.add(record.id);
    previous=n;
    total+=1;
  }
}
assert.equal(total,50000);
assert.equal(ids.size,50000);
assert.equal(previous,50000);
console.log('ERROR_LEARNING_LOG_50000=PASS');
