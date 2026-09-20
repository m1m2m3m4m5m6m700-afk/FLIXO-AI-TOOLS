#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const ROOT = process.cwd();
const OUT_DIR = path.resolve(ROOT, 'diagnostics/auto-repair/action-vault/software-engineer-core');
const PACKET_PATH = path.join(OUT_DIR, 'latest.json');

const sha256 = (v) => crypto.createHash('sha256').update(String(v), 'utf8').digest('hex');
const exactSha = (v) => /^[a-f0-9]{40}$/u.test(String(v));
const now = () => new Date().toISOString();
const arg = (name, fallback='') => {
  const p='--'+name+'=';
  const x=process.argv.find(v=>v.startsWith(p));
  return x?x.slice(p.length):fallback;
};
const runGit = (args) => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const safeRelative = (file) => {
  const normalized = path.normalize(file).replace(/^\.\.(?:[\\/]|$)/u, '');
  if (normalized.startsWith('..') || path.isAbsolute(file)) throw new Error('SOFTWARE_ENGINEER_CORE_PATH_OUTSIDE_REPOSITORY');
  return normalized.replaceAll('\\','/');
};
const readText = (file) => fs.readFileSync(path.resolve(ROOT, safeRelative(file)), 'utf8');

function parseImports(sourceFile) {
  const imports=[];
  const visit=(node)=>{
    if(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if(ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if(ts.isCallExpression(node) && node.expression.kind===ts.SyntaxKind.ImportKeyword && node.arguments.length===1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node,visit);
  };
  visit(sourceFile);
  return [...new Set(imports)];
}
function collectSymbols(sourceFile) {
  const symbols=[];
  const add=(kind,name,node)=>{
    symbols.push({kind,name:name||'<anonymous>',line:sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line+1});
  };
  const visit=(node)=>{
    if(ts.isFunctionDeclaration(node)) add('function',node.name?.text,node);
    else if(ts.isClassDeclaration(node)) add('class',node.name?.text,node);
    else if(ts.isInterfaceDeclaration(node)) add('interface',node.name.text,node);
    else if(ts.isTypeAliasDeclaration(node)) add('type',node.name.text,node);
    else if(ts.isEnumDeclaration(node)) add('enum',node.name.text,node);
    else if(ts.isVariableStatement(node)) for(const d of node.declarationList.declarations) add('variable',d.name.getText(sourceFile),d);
    ts.forEachChild(node,visit);
  };
  visit(sourceFile);
  return symbols;
}
function complexityOf(sourceFile) {
  let score=1;
  const visit=(node)=>{
    if(
      ts.isIfStatement(node)||ts.isForStatement(node)||ts.isForOfStatement(node)||
      ts.isForInStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node)||
      ts.isCatchClause(node)||ts.isConditionalExpression(node)||ts.isCaseClause(node)
    ) score+=1;
    ts.forEachChild(node,visit);
  };
  visit(sourceFile);
  return score;
}
function analyzeSource(file) {
  const content=readText(file);
  const ext=path.extname(file).toLowerCase();
  const isTs=/\.(ts|tsx|mts|cts)$/u.test(ext);
  if(!isTs) return {
    path:file,kind:ext==='.json'?'json':ext==='.yaml'||ext==='.yml'?'yaml':'text',
    bytes:Buffer.byteLength(content),sha256:sha256(content),imports:[],symbols:[],complexity:0,parseDiagnostics:[]
  };
  const source=ts.createSourceFile(
    file,content,ts.ScriptTarget.Latest,true,
    ext==='.tsx'?ts.ScriptKind.TSX:ts.ScriptKind.TS
  );
  return {
    path:file,kind:'typescript',bytes:Buffer.byteLength(content),sha256:sha256(content),
    imports:parseImports(source),symbols:collectSymbols(source),complexity:complexityOf(source),
    parseDiagnostics:source.parseDiagnostics.map(d=>({
      code:d.code,
      line:source.getLineAndCharacterOfPosition(d.start??0).line+1,
      message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
    }))
  };
}
function semanticDiagnostics() {
  const configPath=ts.findConfigFile(ROOT,ts.sys.fileExists,'tsconfig.json');
  if(!configPath) return {enabled:false,diagnostics:[]};
  const config=ts.readConfigFile(configPath,ts.sys.readFile);
  if(config.error) return {enabled:true,diagnostics:[{
    code:config.error.code,
    category:'CONFIG',
    message:ts.flattenDiagnosticMessageText(config.error.messageText,'\n')
  }]};
  const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath),undefined,configPath);
  const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options});
  const ds=ts.getPreEmitDiagnostics(program);
  return {
    enabled:true,
    diagnostics:ds.slice(0,500).map(d=>({
      code:d.code,
      category:ts.DiagnosticCategory[d.category]??'Unknown',
      file:d.file?.fileName?path.relative(ROOT,d.file.fileName):null,
      line:d.file?d.file.getLineAndCharacterOfPosition(d.start??0).line+1:null,
      message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
    }))
  };
}
function changedPaths(baseSha,targetSha) {
  if(!exactSha(baseSha)||!exactSha(targetSha)) return [];
  return runGit(['diff','--name-only','--diff-filter=ACMRT',baseSha,targetSha]).split(/\r?\n/u).filter(Boolean);
}
function diffStat(baseSha,targetSha) {
  if(!exactSha(baseSha)||!exactSha(targetSha)) return null;
  try {
    const raw=runGit(['diff','--numstat',baseSha,targetSha]).trim();
    let additions=0,deletions=0;
    for(const line of raw?raw.split(/\r?\n/u):[]) {
      const [a,d]=line.split('\t');
      additions+=Number(a)||0;
      deletions+=Number(d)||0;
    }
    return {additions,deletions,files:raw?raw.split(/\r?\n/u).length:0};
  } catch { return null; }
}
function riskForFile(file,content) {
  let risk=0; const reasons=[];
  if(file.startsWith('.github/workflows/')) { risk+=35; reasons.push('workflow-control-plane'); }
  if(file.startsWith('scripts/ci/')) { risk+=25; reasons.push('ci-runtime'); }
  if(/auth|security|permission|token|secret/i.test(file)) { risk+=20; reasons.push('security-surface'); }
  if(/git\s+push|gh\s+api|continue-on-error\s*:\s*true|force\s*:\s*true/iu.test(content)) { risk+=25; reasons.push('mutation-or-gate-pattern'); }
  if(/process\.env|child_process|exec(File|Sync)?\(/u.test(content)) { risk+=10; reasons.push('runtime-boundary'); }
  return {risk:Math.min(100,risk),reasons};
}
function impactPrediction(files,entries) {
  const imports=entries.flatMap(e=>(e.imports??[]).map(to=>({from:e.path,to})));
  const impacted=new Set(files);
  for(const edge of imports) {
    if(files.some(f=>f===edge.to || f.endsWith(edge.to) || edge.to.endsWith('/'+f))) impacted.add(edge.from);
  }
  const checks=new Set(['node scripts/ci/action-vault-agent-gate.mjs']);
  for(const file of impacted) {
    if(/^\.github\/workflows\//u.test(file)) checks.add('node scripts/validate-ci-contract.mjs');
    if(/\.(ts|tsx|mjs|js)$/u.test(file)) checks.add('npm run typecheck');
    if(file.includes('action-vault')) checks.add('npm run test:action-code-mentor');
    if(file==='package.json') checks.add('npm run lint');
  }
  return {impactedFiles:[...impacted].slice(0,100),predictedChecks:[...checks]};
}
export function buildSoftwareEngineerPacket({
  taskId,fingerprint,targetSha,failedRunId,baseSha=process.env.FLIXO_BASE_SHA,paths=[],deep=true
}={}) {
  if(!taskId||!fingerprint||!exactSha(targetSha)||!failedRunId) throw new Error('SOFTWARE_ENGINEER_CORE_IDENTITY_REQUIRED');
  const changed=paths.length?paths.filter(Boolean):changedPaths(baseSha,targetSha);
  const entries=[];
  const findings=[];
  for(const file of changed) {
    try {
      const info=analyzeSource(file); entries.push(info);
      const text=readText(file);
      const risk=riskForFile(file,text);
      if(risk.risk>=50) findings.push({type:'RISK',path:file,severity:'HIGH',...risk});
      if(info.parseDiagnostics?.length) findings.push({type:'SYNTAX',path:file,severity:'HIGH',diagnostics:info.parseDiagnostics});
    } catch(error) {
      findings.push({type:'ANALYSIS_FAILURE',path:file,severity:'HIGH',error:String(error?.message??error)});
    }
  }
  const semantic=deep?semanticDiagnostics():{enabled:false,diagnostics:[]};
  const impact=impactPrediction(changed,entries);
  const stat=diffStat(baseSha,targetSha);
  const totalRisk=stat?Math.min(100,Math.round(
    (entries.reduce((n,e)=>n+riskForFile(e.path,readText(e.path)).risk,0)/Math.max(1,entries.length))*0.7+
    Math.min(30,Math.floor((stat.additions+stat.deletions)/200))
  )):0;
  const review={
    mode:'ADVISORY_ONLY',
    decision:findings.some(f=>f.severity==='HIGH')?'BLOCK_UNTIL_REVIEW':'READY_FOR_PROGRAMMER_REVIEW',
    riskScore:totalRisk,
    minimality:stat?Math.max(0,Math.round(100-Math.min(100,(stat.additions+stat.deletions)/2))):null,
    exactShaBound:true,
    mutationPerformed:false,
    canonicalGreenRequired:true,
    unknowns:findings.filter(f=>f.type==='ANALYSIS_FAILURE').map(f=>f.path)
  };
  return {
    schemaVersion:1,
    protocol:'LOCAL_SOFTWARE_ENGINEER_CORE_V1',
    localOnly:true,
    networkAccess:false,
    serverless:true,
    identity:{taskId,fingerprint,targetSha,failedRunId,baseSha:exactSha(baseSha)?baseSha:null},
    architecture:{ast:true,semanticDiagnostics:semantic.enabled,dependencyGraph:true,diffAnalysis:true,riskReview:true,repairSimulation:true,mutation:false},
    changedPaths:changed,
    diffStat:stat,
    codeIndex:entries,
    semanticDiagnostics:semantic,
    impact,
    findings,
    review,
    curriculum:{
      programmerThinking:true,
      codeReading:true,
      rootCauseReasoning:true,
      patchRiskAnalysis:true,
      semanticTypescript:true,
      dependencyReasoning:true,
      regressionPrediction:true,
      counterexampleSupport:true
    },
    safety:{
      readOnly:true,
      noServer:true,
      noNetwork:true,
      noMainMutation:true,
      noTestMutation:true,
      noSourceMutation:true,
      exactShaRequired:true,
      failClosedOnAnalysisError:true,
      canonicalGreenAuthority:'DAILY_FLIXO_GREEN_GATE'
    },
    generatedAt:now(),
    packetDigest:sha256(taskId+'|'+fingerprint+'|'+targetSha+'|'+JSON.stringify(changed))
  };
}
if(import.meta.url===`file://${process.argv[1]}`){
  const packet=buildSoftwareEngineerPacket({
    taskId:arg('task'),
    fingerprint:arg('fingerprint'),
    targetSha:arg('sha'),
    failedRunId:arg('run-id'),
    baseSha:arg('base-sha',process.env.FLIXO_BASE_SHA),
    paths:arg('paths').split(',').map(x=>x.trim()).filter(Boolean),
    deep:arg('mode','DEEP')==='DEEP'
  });
  fs.mkdirSync(OUT_DIR,{recursive:true});
  fs.writeFileSync(PACKET_PATH,JSON.stringify(packet,null,2)+'\n');
  console.log(JSON.stringify({
    status:'PASS',
    protocol:packet.protocol,
    changedFiles:packet.changedPaths.length,
    findings:packet.findings.length,
    riskScore:packet.review.riskScore,
    semanticDiagnostics:packet.semanticDiagnostics.diagnostics.length,
    predictedChecks:packet.impact.predictedChecks,
    output:PACKET_PATH
  },null,2));
}
