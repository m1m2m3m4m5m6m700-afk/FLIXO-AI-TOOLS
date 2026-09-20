import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPreparedChanges, extractPreparedChanges, preparedPlan } from './prepared-source-change.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-prepared-'));
const file = path.join(dir, 'src/example.ts');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, 'export const x = 1;\n');
const repo = execRepo(dir);
function execRepo(cwd) { return require('node:child_process').execFileSync('git',['init','--quiet'],{cwd,encoding:'utf8'}); }
require('node:child_process').execFileSync('git',['config','user.email','test@example.com'],{cwd:dir});
require('node:child_process').execFileSync('git',['config','user.name','test'],{cwd:dir});
require('node:child_process').execFileSync('git',['add','.'],{cwd:dir});
require('node:child_process').execFileSync('git',['commit','--quiet','-m','seed'],{cwd:dir});
const baseline = require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
const blob = require('node:child_process').execFileSync('git',['hash-object','src/example.ts'],{cwd:dir,encoding:'utf8'}).trim();
const packetPath=path.join(dir,'packet.json');
fs.writeFileSync(packetPath,JSON.stringify({
  preparedOnly:true, mutationPolicy:'NO_DIRECT_MUTATION', baselineSha:baseline,
  preparedChanges:[{path:'src/example.ts',operation:'UPDATE',content:'export const x = 2;\n',baselineSha:blob,repairRationale:'Fix demonstrated source defect',verification:['node test']}]
},null,2));
const parsed=extractPreparedChanges(packetPath,baseline); assert.equal(parsed.ok,true);
const plan=preparedPlan(packetPath,baseline); assert.equal(plan.id,'prepared-source-change'); assert.equal(plan.files.length,1);
assert.throws(()=>extractPreparedChanges(packetPath,'a'.repeat(40)),/BASELINE_SHA_MISMATCH/);
assert.throws(()=>applyPreparedChanges(dir, [{path:'scripts/ci/repair-protocol.mjs',operation:'UPDATE',baselineSha:'',content:'bad',repairRationale:'x',verification:['x']}]),/PROTECTED_PATH/);
assert.equal(applyPreparedChanges(dir,plan.preparedChanges).applied,true);
assert.equal(fs.readFileSync(file,'utf8'),'export const x = 2;\n');
console.log('PREPARED_SOURCE_CHANGE_SELF_TEST=PASS');
