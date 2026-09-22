#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRefAtomically } from './repair-lease.mjs';

const refs=new Set();
const server=http.createServer(async (req,res)=>{
  if(req.method==='POST' && /\/git\/refs$/.test(req.url||'')){
    let body=''; for await(const chunk of req) body+=chunk;
    const payload=JSON.parse(body||'{}'); const ref=String(payload.ref||'');
    if(refs.has(ref)){res.writeHead(422,{'content-type':'application/json'});res.end(JSON.stringify({message:'Reference already exists'}));return;}
    refs.add(ref); res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({ref,object:{sha:String(payload.sha||'')}}));return;
  }
  res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({message:'not found'}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address(); const apiRoot='http://127.0.0.1:'+port; const refName='refs/flixo/test/live-race-'+Date.now(); const sha='a'.repeat(40);
const results=await Promise.all(Array.from({length:100},()=>createRefAtomically({apiRoot,repoName:'test/repo',authToken:'local-test-token',refName,objectSha:sha})));
await new Promise(resolve=>server.close(resolve));
const acquired=results.filter(x=>x.status===201); const claimed=results.filter(x=>x.status===422);
assert.equal(acquired.length,1); assert.equal(claimed.length,99);
console.log(JSON.stringify({workers:100,acquired:acquired.length,alreadyClaimed:claimed.length,pass:true},null,2));
