import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-twin-'));
execFileSync('git',['init','-q'],{cwd:dir});
execFileSync('git',['config','user.email','test@example.com'],{cwd:dir});
execFileSync('git',['config','user.name','test'],{cwd:dir});
fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','example.ts'),'export function example(){return "ok";}\n');
execFileSync('git',['add','.'],{cwd:dir});
execFileSync('git',['commit','-qm','base'],{cwd:dir});
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();

fs.mkdirSync(path.join(dir,'tmp'),{recursive:true});
fs.writeFileSync(path.join(dir,'tmp','selection.json'),JSON.stringify({
 protocol:'ACTION-FILE-SELECTION-INTELLIGENCE-v1',agentId:'ACTION-HISTORIAN-3',decision:'SELECTED',
 targetSha:sha,failureFingerprint:'fp-1',selectedFiles:[{path:'src/example.ts'}],excludedFiles:[]
}));
fs.writeFileSync(path.join(dir,'tmp','diagnosis.json'),JSON.stringify({
 rootCause:'lint',location:{file:'src/example.ts'}
}));
fs.writeFileSync(path.join(dir,'tmp','failure.log'),'ERROR lint failure in src/example.ts\n');

const src=fs.readFileSync('scripts/ci/action-repair-programmer-twin.mjs','utf8');
const shim=path.join(dir,'twin.mjs');
fs.writeFileSync(shim,src);
const out=path.join(dir,'tmp','out.json');
execFileSync(process.execPath,[shim,'--sha='+sha,'--fingerprint=fp-1','--run-id=1','--log='+path.join(dir,'tmp','failure.log'),'--file-selection='+path.join(dir,'tmp','selection.json'),'--diagnosis='+path.join(dir,'tmp','diagnosis.json'),'--output='+out],{cwd:dir});
const report=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(report.protocol,'INDEPENDENT_FALSIFICATION_REPORT-v1');
assert.equal(report.role,'ADVERSARIAL_PROGRAMMER_FALSIFIER');
assert.equal(report.sourceMutationAllowed,false);
assert.equal(report.targetSha,sha);
assert.equal(report.failureFingerprint,'fp-1');
assert.equal(report.falsificationSearches.length,10);
assert.equal(report.falsificationSearches.every(x=>Object.hasOwn(x,'result')&&Object.hasOwn(x,'evidence')&&Object.hasOwn(x,'counterexample')),true);
console.log('ACTION_PROGRAMMER_TWIN=PASS');