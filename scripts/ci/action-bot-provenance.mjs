#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const arg=(n,f='')=>{const p='--'+n+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const sha=arg('sha')||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const subject=execFileSync('git',['show','-s','--format=%s',sha],{encoding:'utf8'}).trim();
const body=execFileSync('git',['show','-s','--format=%B',sha],{encoding:'utf8'});
const changed=execFileSync('git',['show','--format=','--name-only',sha],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean);
const pick=(name)=>{const line=body.split(/\r?\n/u).find(x=>x.startsWith(name+'='));return line?line.slice(name.length+1).trim():''};
const botId=pick('FLIXO-BOT-ID');
const role=pick('FLIXO-BOT-ROLE');
const task=pick('FLIXO-BOT-TASK');
const fingerprint=pick('FLIXO-BOT-FINGERPRINT');
const result={schemaVersion:1,commitSha:sha,botAuthored:Boolean(botId),botId:botId||null,role:role||null,taskId:task||null,fingerprint:fingerprint||null,subject,changedFiles:changed,recordedAt:new Date().toISOString(),authority:'FLIXO_BOT_PROVENANCE',status:botId?'BOT_CHANGE_RECORDED':'NON_BOT_OR_LEGACY_COMMIT'};
const out=arg('output');
if(out) fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));