#!/usr/bin/env node
import fs from 'node:fs';

const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));

const requiredGlobal=[
 'allIntelligenceTestsPass','allSecurityTestsPass','allProofTestsPass','allFalsificationTestsPass',
 'allSimulationTestsPass','allDifferentialTestsPass','allRegressionTestsPass',
 'noSkippedTests','noContinueOnError','noWeakenedGate','noFalsePositive','noFalseGreen','noStaleProof','noUnresolvedCounterexample',
];

export function evaluateCertification({
 benchmarkScore=0,
 benchmarkVersion,
 testedCapabilities=[],
 passedTests=[],
 failedTests=[],
 blockedCases=[],
 proofArtifacts=[],
 simulationArtifacts=[],
 differentialArtifacts=[],
 falsificationArtifacts=[],
 exactSha,
 executionSha,
 canonicalGreenRecord=null,
 projectRedCount=null,
 globalChecks={},
 remainingRisks=[],
 knownLimitations=[],
}={}){
  const failures=[];
  if(benchmarkVersion!=='ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1')failures.push('BENCHMARK_VERSION_INVALID');
  if(Number(benchmarkScore)!==100)failures.push('BENCHMARK_NOT_100');
  if(!shaOk(exactSha)||!shaOk(executionSha)||exactSha!==executionSha)failures.push('EXACT_FINAL_SHA_INVALID');
  if(!canonicalGreenRecord||canonicalGreenRecord.source!=='DAILY_FLIXO_GREEN_GATE'||canonicalGreenRecord.conclusion!=='success'||canonicalGreenRecord.zeroRed!==true||canonicalGreenRecord.exactShaVerified!==true||canonicalGreenRecord.targetSha!==executionSha)failures.push('CANONICAL_GREEN_NOT_PROVEN');
  if(projectRedCount!==0)failures.push('PROJECT_RED_COUNT_NOT_ZERO');
  for(const key of requiredGlobal) if(globalChecks[key]!==true) failures.push('GLOBAL_CHECK_FAILED:'+key);
  if(failedTests.length)failures.push('FAILED_TESTS_PRESENT');
  if(blockedCases.length)failures.push('BLOCKED_CASES_PRESENT');
  if(remainingRisks.length)failures.push('REMAINING_RISKS_PRESENT');
  const verified=failures.length===0;
  const certificationScore=verified?Number(benchmarkScore):0;
  return Object.freeze({
    score:certificationScore,
    benchmarkScore:Number(benchmarkScore),
    benchmarkVersion,
    testedCapabilities,
    passedTests,
    failedTests,
    blockedCases,
    proofArtifacts,
    simulationArtifacts,
    differentialArtifacts,
    falsificationArtifacts,
    exactSha,
    executionSha,
    canonicalGreenRecord,
    certificationStatus:verified?'100/100 VERIFIED':'NOT_CERTIFIED',
    certificationGate:verified,
    projectRedCount,
    globalChecks,
    failures,
    remainingRisks,
    knownLimitations,
    generatedAt:new Date().toISOString(),
  });
}

if(process.argv[1]?.endsWith('action-vault-certification.mjs')){
  const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=evaluateCertification(input);
  fs.writeFileSync(process.argv[3]??'/tmp/ACTION-VAULT-100-CERTIFICATION.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(!result.certificationGate)process.exitCode=1;
}
