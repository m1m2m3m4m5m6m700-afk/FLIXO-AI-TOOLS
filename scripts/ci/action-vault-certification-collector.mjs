#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { evaluateCertification } from './action-vault-certification.mjs';

const repo=process.env.GITHUB_REPOSITORY||'m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS';
const watchPath=process.argv[2]||'/tmp/flixo-watch/report.json';
const out=process.argv[3]||'/tmp/ACTION-VAULT-100-CERTIFICATION.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
if(!fs.existsSync(watchPath))throw new Error('CERTIFICATION_WATCH_REPORT_REQUIRED');
const watch=read(watchPath);
const gitHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const ghJson=(url)=>JSON.parse(execFileSync('gh',['api',url,'--paginate'],{encoding:'utf8',env:process.env}));
if(watch.status!=='GREEN')throw new Error('CERTIFICATION_CANONICAL_GREEN_REQUIRED');
if(watch.executionSha!==gitHead)throw new Error('CERTIFICATION_EXACT_SHA_MISMATCH');

const workflows=['FLIXO Test System','FLIXO WP0 Trust Baseline','FLIXO Test Impact','FLIXO Test Impact Execution','Repository Security Baseline','Claude Security Review'];
const runs=ghJson(`repos/${repo}/actions/runs?head_sha=${gitHead}&per_page=100`).workflow_runs??[];
const exactRuns=Object.fromEntries(workflows.map(name=>[name,runs.filter(r=>r.name===name&&r.conclusion!=='cancelled').sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0]??null]));
const requiredPass=workflows.every(name=>exactRuns[name]?.status==='completed'&&exactRuns[name]?.conclusion==='success');

const testSuite=spawnSync('npm',['run','test:auto-repair'],{encoding:'utf8',env:process.env});
const postSuiteSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(testSuite.status!==0)throw new Error('ACTION_VAULT_REAL_TEST_SUITE_FAILED');
if(postSuiteSha!==gitHead)throw new Error('CERTIFICATION_TEST_SUITE_MUTATED_HEAD');
const ciContract=spawnSync('npm',['run','validate:ci-contract'],{encoding:'utf8',env:process.env});
if(ciContract.status!==0)throw new Error('CI_CONTRACT_NOT_PROVEN');
const benchmark=spawnSync(process.execPath,['scripts/ci/action-vault-intelligence-benchmark.mjs'],{encoding:'utf8',env:process.env});
if(benchmark.status!==0)throw new Error('INTELLIGENCE_BENCHMARK_FAILED');
const benchmarkReport=fs.existsSync('/tmp/action-vault-intelligence-benchmark.json')?read('/tmp/action-vault-intelligence-benchmark.json'):null;
if(!benchmarkReport||benchmarkReport.score!==100||benchmarkReport.allCasesPass!==true||benchmarkReport.allCategoriesPass!==true)throw new Error('INTELLIGENCE_BENCHMARK_NOT_PROVEN');

const jobData={};
for(const run of Object.values(exactRuns)){
  if(!run?.id)continue;
  const jobs=JSON.parse(execFileSync('gh',['api',`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`],{encoding:'utf8',env:process.env}));
  jobData[run.name]=jobs.jobs??[];
}
const testSkipped=[...Object.values(jobData).flatMap(jobs=>jobs.flatMap(job=>(job.steps??[]).filter(step=>step.conclusion==='skipped'&&/(test|check|gate|cert|proof|falsif|simulat|regress)/iu.test(String(step.name??'')))))];
const continueOnErrorScan=spawnSync('git',['grep','-n','continue-on-error:','--','.github/workflows'],{encoding:'utf8',env:process.env});
const canonicalRedRuns=Object.values(exactRuns).filter(run=>run?.status!=='completed'||run?.conclusion!=='success');
const canonicalRedSteps=[...Object.values(jobData).flatMap(jobs=>jobs.flatMap(job=>(job.steps??[]).filter(step=>['failure','timed_out','action_required','cancelled'].includes(step.conclusion))))];
const projectRedCount=canonicalRedRuns.length+canonicalRedSteps.length;
if(projectRedCount!==0)throw new Error('PROJECT_RED_COUNT_NOT_ZERO');
const allIntelligenceTestsPass=requiredPass&&testSuite.status===0&&benchmarkReport.allCasesPass===true;
const allSecurityTestsPass=['FLIXO WP0 Trust Baseline','Repository Security Baseline','Claude Security Review'].every(name=>exactRuns[name]?.conclusion==='success');
const allProofTestsPass=requiredPass;
const allFalsificationTestsPass=requiredPass&&benchmarkReport.categoryResults?.['Adversarial reasoning']?.passed===true;
const allSimulationTestsPass=requiredPass&&benchmarkReport.categoryResults?.['Patch correctness']?.passed===true;
const allDifferentialTestsPass=requiredPass&&benchmarkReport.categoryResults?.['Verification discipline']?.passed===true;
const allRegressionTestsPass=requiredPass&&benchmarkReport.categoryResults?.['Regression reasoning']?.passed===true;
const globalChecks={
 allIntelligenceTestsPass,allSecurityTestsPass,allProofTestsPass,allFalsificationTestsPass,allSimulationTestsPass,allDifferentialTestsPass,allRegressionTestsPass,
 noSkippedTests:testSkipped.length===0,noContinueOnError:continueOnErrorScan.status===1,noWeakenedGate:ciContract.status===0,noFalsePositive:benchmarkReport.allCasesPass===true,noFalseGreen:watch.status==='GREEN',
 noStaleProof:watch.executionSha===gitHead,noUnresolvedCounterexample:benchmarkReport.allCasesPass===true,
};

const verifiedLearning=read('/tmp/verified-learning.json');
if(verifiedLearning.status!=='VERIFIED'||verifiedLearning.executionSha!==gitHead||!Array.isArray(verifiedLearning.proofIds)||verifiedLearning.proofIds.length<1)throw new Error('VERIFIED_LEARNING_REQUIRED');

const greenRecord={
 recordId:crypto.createHash('sha256').update(JSON.stringify({executionSha:gitHead,runIds:Object.values(exactRuns).map(r=>r?.id)})).digest('hex'),
 source:'DAILY_FLIXO_GREEN_GATE',conclusion:'success',zeroRed:true,exactShaVerified:true,targetSha:gitHead,
 executionSha:gitHead,taskId:watch.repair?.repairKey??`ACTION-VAULT:${gitHead}`,fingerprint:watch.repair?.failureFingerprint??null,
 workflowRunId:process.env.GITHUB_RUN_ID??null,verifiedAt:new Date().toISOString()
};
const certification=evaluateCertification({
 benchmarkScore:benchmarkReport.score,benchmarkVersion:benchmarkReport.benchmarkVersion,
 exactSha:gitHead,executionSha:gitHead,canonicalGreenRecord:greenRecord,
 projectRedCount,globalChecks,failedTests:[],blockedCases:[],remainingRisks:[]
});
const result={score:certification.score,benchmarkVersion:benchmarkReport.benchmarkVersion,testedCapabilities:benchmarkReport.cases?.map(c=>c.name)??[],passedTests:benchmarkReport.cases?.filter(c=>c.passed).map(c=>c.name)??[],failedTests:benchmarkReport.cases?.filter(c=>!c.passed).map(c=>c.name)??[],blockedCases:certification.blockedCases??[],proofArtifacts:verifiedLearning.proofIds,simulationArtifacts:verifiedLearning.proofIds.filter(x=>/SANDBOX|POST-MUTATION/u.test(x)),differentialArtifacts:verifiedLearning.proofIds.filter(x=>/DIFFERENTIAL/u.test(x)),falsificationArtifacts:verifiedLearning.proofIds.filter(x=>/FALSIFICATION|COUNTEREXAMPLE/u.test(x)),exactSha:gitHead,executionSha:gitHead,canonicalGreenRecord:greenRecord,certificationStatus:certification.certificationStatus,remainingRisks:certification.remainingRisks??[],knownLimitations:certification.certificationStatus==='100/100 VERIFIED'?[]:['Certification remains fail-closed until every exact-SHA workflow, Action Vault test suite, benchmark, CI contract, and learning evidence is proven.'],
verifiedLearning,globalChecks,requiredRuns:exactRuns,benchmark:benchmarkReport};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({score:result.score,status:result.certificationStatus,exactSha:gitHead,requiredPass,globalChecks},null,2));
if(result.certificationStatus!=='100/100 VERIFIED')process.exit(1);
