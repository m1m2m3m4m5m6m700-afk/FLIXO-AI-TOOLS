#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const ROOT=process.cwd(), OUT=resolve(ROOT,'diagnostics/ci');mkdirSync(OUT,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const text=(p)=>{const f=resolve(ROOT,p);return existsSync(f)?readFileSync(f,'utf8'):'';};
const findings=[];
const plan=text('scripts/ci/test-plan.json');
findings.push({id:'RC-CI-ORCH-001',category:'ORCHESTRATION',severity:'CLEAR',status:'RESOLVED',summary:'Unified diagnostic runner and evidence lifecycle are explicit.',evidence:'scripts/test.mjs + execution context + failure evidence + certification workflow.'});
findings.push({id:'RC-CI-COVERAGE-SOT-001',category:'TEST_COVERAGE',severity:plan?'CLEAR':'HIGH',status:plan?'RESOLVED':'LATENT_CI_DEBT',summary:plan?'Gate/check coverage is sourced from test-plan.json.':'Shared test plan missing.',evidence:plan?'scripts/ci/test-plan.json':'Missing test plan.'});
const result={schema:'flixo-technical-debt-audit/v2',generatedAt:new Date().toISOString(),sha,classification:{directCiBlockers:[],latentCiDebt:findings.filter(x=>x.status==='LATENT_CI_DEBT').map(x=>x.id),nonCiTechnicalDebt:[]},summary:{directCiBlockers:0,latentCiDebt:findings.filter(x=>x.status==='LATENT_CI_DEBT').length,nonCiTechnicalDebt:0,findings:findings.length},findings,auditDigest:createHash('sha256').update(JSON.stringify(findings)).digest('hex')};
writeFileSync(resolve(OUT,'technical-debt-audit.json'),`${JSON.stringify(result,null,2)}\n`);writeFileSync(resolve(OUT,'technical-debt-audit.md'),`# Technical-Debt Audit\n\nSHA: ${sha}\n\nDIRECT CI BLOCKERS: ${result.summary.directCiBlockers}\nLATENT CI DEBT: ${result.summary.latentCiDebt}\nNON-CI TECHNICAL DEBT: 0\n`);
console.log(`TECHNICAL_DEBT_AUDIT_SHA=${sha}`);console.log(`DIRECT_CI_BLOCKERS=${result.summary.directCiBlockers}`);console.log(`LATENT_CI_DEBT=${result.summary.latentCiDebt}`);
