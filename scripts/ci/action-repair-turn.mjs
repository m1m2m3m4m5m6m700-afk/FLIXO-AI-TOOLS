#!/usr/bin/env node
const arg=(n,f='')=>{const p='--'+n+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const attempt=Number(arg('attempt','1'));
const sha=arg('sha');
const fp=arg('fingerprint');
const prev=arg('previous-outcome','');
if(!Number.isInteger(attempt)||attempt<1) throw new Error('ACTION_PAIR_ATTEMPT_INVALID');
if(!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('ACTION_PAIR_SHA_INVALID');
if(!fp) throw new Error('ACTION_PAIR_FINGERPRINT_REQUIRED');
const active=attempt%2===1?'ACTION-REPAIR':'ACTION-REPAIR-2';
const waiting=active==='ACTION-REPAIR'?'ACTION-REPAIR-2':'ACTION-REPAIR';
const handoff=attempt>1;
const result={schemaVersion:1,kind:'ACTION_REPAIR_TWO_BOT_TURN',attempt,activeBot:active,waitingBot:waiting,targetSha:sha,fingerprint:fp,requiresPrimaryApproval:active==='ACTION-REPAIR-2',handoff,stopCondition:'ZERO_ACTIONABLE_RED',externalBlockStopsMutation:true};
console.log(JSON.stringify(result,null,2));