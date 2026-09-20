#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ID_RE=/^CELL-(\\d{3})$/u;
const botIds=Array.from({length:200},(_,i)=>`CELL-${String(i+1).padStart(3,'0')}`);
function ensureCellPool(root=process.cwd()){
  const base=path.resolve(root);
  const memDir=path.join(base,'diagnostics/auto-repair/cell-bots');
  const knowDir=path.join(base,'diagnostics/auto-repair/cell-knowledge');
  fs.mkdirSync(memDir,{recursive:true}); fs.mkdirSync(knowDir,{recursive:true});
  const templateMemory={
    schemaVersion:1,authority:'CELL_BOT_PERSONAL_MEMORY',botId:null,copyable:true,
    transferableKnowledgeOnly:true,permanentIndependentAuthority:false,
    identity:{shortName:null,fullName:null,version:0},
    state:{status:'LEARNING',taskCount:0,lastTaskId:null,lastUpdatedAt:null},
    learnedTasks:[],knowledge:[],successfulStrategies:[],failedStrategies:[],solutions:[],
    weaknesses:[],upgrades:[],sourceEvidence:[],importHistory:[],exportHistory:[]
  };
  const templateKnowledge={
    schemaVersion:1,authority:'CELL_CONTROL_PLANE',botId:null,
    identity:{writerId:null,writerType:'RAW_BOT',supervisor:'assistantController'},
    weaknessProfile:{upgradePriority:1,weakness:'FIRST_TASK_EVIDENCE',upgradeTarget:'Complete first reviewed task'},
    taskHistory:[],knowledgeItems:[]
  };
  let memoryCreated=0,knowledgeCreated=0;
  for(const id of botIds){
    if(!ID_RE.test(id)) throw new Error('CELL_BOOTSTRAP_ID_INVALID');
    const mp=path.join(memDir,id+'.json');
    const kp=path.join(knowDir,id+'.json');
    if(!fs.existsSync(mp)){fs.writeFileSync(mp,JSON.stringify({...templateMemory,botId:id},null,2)+'\\n');memoryCreated++;}
    if(!fs.existsSync(kp)){fs.writeFileSync(kp,JSON.stringify({...templateKnowledge,botId:id,identity:{...templateKnowledge.identity,writerId:id}},null,2)+'\\n');knowledgeCreated++;}
  }
  return {botCount:200,memoryCreated,knowledgeCreated,memoryDir:memDir,knowledgeDir:knowDir};
}
if(import.meta.url===`file://${process.argv[1]}`) console.log(JSON.stringify(ensureCellPool(process.argv[2]||process.cwd()),null,2));
export {ensureCellPool};
