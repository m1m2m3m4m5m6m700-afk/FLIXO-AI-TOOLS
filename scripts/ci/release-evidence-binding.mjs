#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.argv[2] || process.env.FLIXO_RELEASE_EVIDENCE;
const expectedSha=process.env.EXACT_SHA || process.env.GITHUB_SHA || '';
if(!file) throw new Error('RELEASE_EVIDENCE_FILE_REQUIRED');
if(!/^[a-f0-9]{40}$/u.test(expectedSha)) throw new Error('EXACT_SHA_REQUIRED');
if(!fs.existsSync(file)) throw new Error('RELEASE_EVIDENCE_FILE_MISSING');

const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
const failures=[];
if(evidence.commitSha!==expectedSha) failures.push('COMMIT_SHA_MISMATCH');
if(!evidence.verification || !evidence.deployment || !evidence.runtime) failures.push('RELEASE_EVIDENCE_SECTIONS_MISSING');
if(!['passed','failed','unknown'].includes(evidence.verification?.state)) failures.push('VERIFICATION_STATE_INVALID');
if(!['passed','failed','unknown'].includes(evidence.verification?.canonicalGate)) failures.push('CANONICAL_GATE_STATE_INVALID');
if(!['passed','failed','unknown'].includes(evidence.verification?.requiredChecks)) failures.push('REQUIRED_CHECKS_STATE_INVALID');
if(!['deployed','blocked','failed','unknown'].includes(evidence.deployment?.state)) failures.push('DEPLOYMENT_STATE_INVALID');
if(!['healthy','degraded','failed','unknown'].includes(evidence.runtime?.state)) failures.push('RUNTIME_STATE_INVALID');
if(evidence.artifact?.sha256 && !/^[a-f0-9]{64}$/u.test(evidence.artifact.sha256)) failures.push('ARTIFACT_SHA256_INVALID');

const payload={schemaVersion:1,expectedSha,commitSha:evidence.commitSha,verification:evidence.verification,deployment:evidence.deployment,runtime:evidence.runtime,artifact:evidence.artifact??null};
const evidenceHash=crypto.createHash('sha256').update(JSON.stringify(payload),'utf8').digest('hex');
const result={schemaVersion:1,contract:'FLIXO_RELEASE_EVIDENCE_BINDING',status:failures.length?'FAIL':'PASS',exactSha:failures.includes('COMMIT_SHA_MISMATCH')?false:true,evidenceHash,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exit(1);
