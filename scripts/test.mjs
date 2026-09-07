#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'diagnostics/ci');
mkdirSync(DIR, { recursive: true });
const args = process.argv.slice(2);
const gate = args.find((arg) => arg.startsWith('--gate='))?.slice(7) ?? null;
const mode = args.find((arg) => arg.startsWith('--mode='))?.slice(7) ?? 'certification';
const GATES = ['static', 'build', 'browser'];
if (!['certification', 'diagnose'].includes(mode) || (gate && !GATES.includes(gate))) process.exit(2);
const now = () => new Date().toISOString();
const git = (args) => { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : 'UNKNOWN'; };
const sha = () => git(['rev-parse', 'HEAD']);
const rootCauses = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/root-causes.json'), 'utf8'));
const runNode = (script) => spawnSync(process.execPath, [script], { cwd: ROOT, env: process.env, encoding: 'utf8' });
const CHECKS = {
  static: [
    ['typescript','npx',['tsc','--noEmit','--pretty','false'],'RC-TYPE-001'], ['lint','npm',['run','lint'],'RC-TYPE-001'], ['unit','npm',['run','test:unit'],'RC-UNKNOWN-001'],
    ['tool-localization','npm',['run','test:tool-localization'],'RC-I18N-001'], ['baseline','npm',['run','validate:baseline'],'RC-UNKNOWN-001'], ['tool-registry','npm',['run','validate:tool-registry'],'RC-UNKNOWN-001'],
    ['tool-manifest','npm',['run','validate:tool-manifest'],'RC-UNKNOWN-001'], ['router','npm',['run','validate:router-registry'],'RC-ROUTER-001'], ['i18n','npm',['run','validate:i18n'],'RC-I18N-001'],
    ['language-quality','npm',['run','validate:language-quality'],'RC-I18N-001'], ['locale-integrity','npm',['run','validate:locale-integrity'],'RC-I18N-001'], ['locale-navigation','npm',['run','validate:locale-navigation'],'RC-I18N-001'],
    ['home-i18n','npm',['run','validate:home-i18n'],'RC-I18N-001'], ['localization-full','npm',['run','validate:localization-full'],'RC-I18N-001'], ['localization-complete','npm',['run','validate:localization-complete'],'RC-I18N-001'],
    ['seo','npm',['run','validate:seo'],'RC-SEO-001'], ['seo-manifest','npm',['run','validate:seo-manifest'],'RC-SEO-001'], ['indexing','npm',['run','validate:indexing'],'RC-SEO-001'],
    ['breadcrumb-seo','npm',['run','validate:breadcrumb-seo'],'RC-SEO-001'], ['ci-contract','npm',['run','validate:ci-contract'],'RC-CI-CONTRACT-001'], ['image-only','npm',['run','validate:image-only-closure'],'RC-UNKNOWN-001'],
    ['dependency-zero-debt','npm',['run','validate:dependency-zero-debt'],'RC-DEPENDENCY-001'], ['file-safety','node',['--experimental-strip-types','scripts/test-file-safety.mjs'],'RC-G2-SIGNATURE-001'],
    ['output-integrity','node',['--experimental-strip-types','scripts/test-output-integrity.mjs'],'RC-G3-INTEGRITY-001'], ['svg-integrity','node',['--experimental-strip-types','scripts/test-svg-integrity.mjs'],'RC-G2-SIGNATURE-001'],
    ['release-evidence','node',['scripts/test-release-evidence.mjs'],'RC-CI-EVIDENCE-001'], ['technical-debt-audit','npm',['run','audit:technical-debt'],'RC-CI-TECHNICAL-DEBT-001'],
  ],
  build: [['typescript','npx',['tsc','--noEmit','--pretty','false'],'RC-TYPE-001'],['build','npm',['run','build'],'RC-BUILD-001'],['dist','node',['-e',"const fs=require('node:fs'); for(const p of ['dist','dist/index.html']) if(!fs.existsSync(p)) throw new Error('Missing build output: '+p);"],'RC-BUILD-001']],
};
const EXPECTED = { static: CHECKS.static.length, build: CHECKS.build.length, browser: 3 };
function execute(label, command, commandArgs, env = {}) { const startedAt = now(); const r = spawnSync(command, commandArgs, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' }); const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.slice(-16000); process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); return { label, command: [command, ...commandArgs].join(' '), status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status ?? 1, startedAt, completedAt: now(), output }; }
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
function normalize(output) { return output.replace(ansi,'').replace(/https?:\/\/[^\s]+/g,'<URL>').replace(/[A-Za-z]:\\[^\s]+/g,'<PATH>').replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g,'<PATH>').replace(/[0-9a-f]{7,40}/gi,'<SHA>').replace(/\d+(?:\.\d+)?/g,'#').replace(/\s+/g,' ').trim(); }
function signature(check) { return [...new Set(check.output.split(/\r?\n/).map(normalize).filter((line)=>/error|failed|failure|cannot|not assignable|not found|expected|received|timeout|exception|assert|locale|route|canonical|hreflang|playwright|chromium|firefox|webkit/i.test(line)).filter(Boolean))].sort().slice(0,40).join(' ').slice(0,5000); }
const fallback = [['RC-DEPENDENCY-001',/cannot find module|npm err|npm ci|lockfile|package-lock|ERESOLVE/i],['RC-TYPE-001',/TS\d+|Type error|not assignable|cannot find name/i],['RC-I18N-001',/translation|locale|language|English leakage|localized/i],['RC-SEO-001',/canonical|hreflang|robots|sitemap|seo/i],['RC-ROUTER-001',/route|404|not found|path resolver/i],['RC-BUILD-001',/build failed|vite.*error|rollup|esbuild/i]];
function classify(gateName, check, declared) { if (check.status === 'PASS') return null; if (declared && rootCauses[declared]) return declared; for (const [id,re] of fallback) if (re.test(check.output)) return id; return gateName === 'browser' ? 'RC-BROWSER-001' : 'RC-UNKNOWN-001'; }
function enrich(gateName, check, declared) { const id=classify(gateName,check,declared); if(check.status==='PASS') return {...check,rootCauseId:null,fingerprint:null,repro:null,error:null}; const fp=`FPR-${createHash('sha256').update([id,gateName,check.label,signature(check)].join('\n')).digest('hex').slice(0,12).toUpperCase()}`; return {...check,rootCauseId:id,fingerprint:fp,repro:gateName==='browser'?`npx playwright test --project=${check.label}`:check.command,error:{category:rootCauses[id]?.category??'UNKNOWN',normalized:normalize(check.output).slice(-4000)}}; }
function report(gateName, results, status) { const checks=results.map((x)=>enrich(gateName,x.result,x.rootCause)); const failures=checks.filter((x)=>x.status==='FAIL'); const r={version:5,schema:'flixo-gate-report/v5',sha:sha(),gate:gateName.toUpperCase(),mode,status,failures:failures.length,checksExpected:EXPECTED[gateName],checksExecuted:checks.length,rootCauses:[...new Set(failures.map((x)=>x.rootCauseId).filter(Boolean))],completedAt:now(),checks}; writeFileSync(resolve(DIR,`${gateName}.json`),`${JSON.stringify(r,null,2)}\n`); return r; }
function runChecks(gateName) { const results=[]; for(const [label,cmd,a,rc] of CHECKS[gateName]) { const result=execute(label,cmd,a); results.push({result,rootCause:rc}); if(mode==='certification'&&result.status==='FAIL') break; } return report(gateName,results,results.length===EXPECTED[gateName]&&results.every((x)=>x.result.status==='PASS')?'PASS':'FAIL'); }
async function waitForServer(url) { for(let i=0;i<40;i+=1){try{const r=await fetch(url);if(r.ok)return;}catch{} await new Promise((resolveSleep)=>setTimeout(resolveSleep,500));} throw new Error(`Preview server did not become ready: ${url}`); }
async function browserGate() { const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','3000'],{cwd:ROOT,env:{...process.env,CI:'true'},stdio:'ignore'}); try { await waitForServer('http://127.0.0.1:3000'); const results=[]; for(const project of ['chromium','firefox','webkit']){const result=execute(project,'npx',['playwright','test',`--project=${project}`],{CI:'true',S4_EXTERNAL_SERVER:'true',PLAYWRIGHT_REUSE_SERVER:'false'}); results.push({result,rootCause:'RC-BROWSER-001'}); if(mode==='certification'&&result.status==='FAIL')break;} return report('browser',results,results.length===3&&results.every((x)=>x.result.status==='PASS')?'PASS':'FAIL'); } finally { server.kill('SIGTERM'); } }
function blocked(){return report('browser',[],'BLOCKED');}
function overall(reports,target){const failures=reports.flatMap((r)=>(r.checks??[]).filter((c)=>c.status==='FAIL'));const roots=[...new Set(failures.map((c)=>c.rootCauseId).filter(Boolean))];const pass=reports.length===target.length&&reports.every((r)=>r.status==='PASS'&&r.checksExpected===r.checksExecuted)&&failures.length===0;const out={version:5,schema:'flixo-ci-report/v5',mode,sha:sha(),status:pass?'PASS':'FAIL',gatesExpected:target.length,gatesExecuted:reports.length,rootCauses:roots,firstFailure:failures[0]?{rootCauseId:failures[0].rootCauseId,fingerprint:failures[0].fingerprint,repro:failures[0].repro}:null,completedAt:now()};writeFileSync(resolve(DIR,'report.json'),`${JSON.stringify(out,null,2)}\n`);writeFileSync(resolve(DIR,'failures.json'),`${JSON.stringify(failures,null,2)}\n`);return out;}

const currentSha=sha(); if(process.env.EXPECTED_SHA&&process.env.EXPECTED_SHA!==currentSha){console.error(`EXACT SHA VIOLATION: expected ${process.env.EXPECTED_SHA}, executed ${currentSha}`);process.exit(1);} if(!existsSync(resolve(ROOT,'node_modules/.package-lock.json'))){console.error('DEPENDENCY STATE VIOLATION: npm ci must complete before certification runner.');process.exit(1);}
const context=runNode('scripts/ci/capture-execution-context.mjs');process.stdout.write(context.stdout??'');process.stderr.write(context.stderr??'');if((context.status??1)!==0)process.exit(context.status??1);
const target=gate?[gate]:GATES;const reports=[];for(const name of target){const r=name==='static'?runChecks('static'):name==='build'?runChecks('build'):(reports.find((x)=>x.gate==='BUILD')?.status==='PASS'?await browserGate():blocked());reports.push(r);if(mode==='certification'&&r.status!=='PASS')break;}
const result=overall(reports,target);for(const script of ['scripts/ci/normalize-reproduction.mjs','scripts/ci/collect-failure-evidence.mjs','scripts/ci/record-repair-cycle.mjs','scripts/ci/detect-shared-root-candidates.mjs']){const r=runNode(script);process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if((r.status??1)!==0)console.error(`Supporting diagnostic ${script} returned ${r.status??1}.`);}process.exit(result.status==='PASS'?0:1);
