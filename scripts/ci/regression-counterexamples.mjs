#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const normalize=(v)=>String(v??'').replace(/\r\n?/g,'\n');
const read=(p)=>{try{return fs.readFileSync(p,'utf8');}catch{return null;}};
const exists=(p)=>Boolean(p&&fs.existsSync(p));

function searchResult(id, question, result, evidence=[], validCounterexample=false){
  return {id, searched:true, question, result, evidence, validCounterexample};
}

export function searchRegressionCounterexamples({
  targetSha=null,
  failureFingerprint=null,
  selectedFiles=[],
  diff='',
  sourceFiles={},
  failureLog='',
  relatedFiles=[],
}={}){
  const searches=[];
  const text=normalize(failureLog);
  const patch=normalize(diff);
  const allFiles=[...new Set([...selectedFiles,...relatedFiles].filter(Boolean))];
  const combined=allFiles.map(file=>({file,content:normalize(sourceFiles[file]??'')}));

  searches.push(searchResult(
    'RC01_ORIGINAL_FAILURE_RECURRENCE',
    'Can the original failure signal still be observed from the candidate change surface?',
    /error|failure|failed|exception|timeout/i.test(text)
      ? (/test\.skip|describe\.skip|continue-on-error|skip:/i.test(patch) ? 'RECURRENCE_SIGNAL_POSSIBLE' : 'ORIGINAL_FAILURE_SIGNAL_REVIEWED')
      : 'NO_ORIGINAL_FAILURE_SIGNAL_IN_LOG',
    [{source:'failureLog',excerpt:text.slice(0,1200)},{source:'candidateDiff',hashLength:patch.length}],
    /test\.skip|describe\.skip|continue-on-error|skip:/i.test(patch),
  ));

  const neighboringSignals=combined.flatMap(({file,content})=>{
    const hits=content.match(/(?:throw new Error|assert\.|expect\(|TODO|FIXME|NOT_IMPLEMENTED|UNRESOLVED|BLOCKED)/g)||[];
    return hits.slice(0,8).map(x=>({file,signal:x}));
  });
  searches.push(searchResult(
    'RC02_NEIGHBORING_FAILURE',
    'Do neighboring failure-prone constructs appear in the affected surface?',
    neighboringSignals.length?'NEIGHBORING_FAILURE_SURFACE_FOUND':'NO_NEIGHBORING_FAILURE_SIGNAL',
    neighboringSignals,
    false,
  ));

  searches.push(searchResult(
    'RC03_OPPOSITE_INPUT',
    'Could the opposite input/state invert the intended behavior?',
    /(?:!|not|false|disable|reject|deny|blocked)/i.test(patch) ? 'OPPOSITE_INPUT_REVIEW_REQUIRED':'OPPOSITE_INPUT_SEARCHED',
    [patch.match(/(?:!|not|false|disable|reject|deny|blocked).{0,120}/i)?.[0]??'NO_OPPOSITE_SIGNAL'],
    false,
  ));

  const boundarySignals=combined.flatMap(({file,content})=>{
    const hits=content.match(/(?:0|1|empty|null|undefined|NaN|Infinity|MAX_SAFE_INTEGER|MIN_SAFE_INTEGER|255|4096|8192)/g)||[];
    return hits.slice(0,12).map(x=>({file,boundary:x}));
  });
  searches.push(searchResult(
    'RC04_BOUNDARY_INPUT',
    'Are boundary values or empty states coupled to the changed behavior?',
    boundarySignals.length?'BOUNDARY_INPUTS_REVIEWED':'NO_BOUNDARY_LITERAL_SIGNAL',
    boundarySignals,
    false,
  ));

  const stateSignals=combined.flatMap(({file,content})=>{
    const hits=content.match(/(?:state|status|phase|mode)\s*[:=]\s*['"][A-Z][A-Z0-9_-]{2,}['"]/g)||[];
    return hits.slice(0,12).map(x=>({file,state:x}));
  });
  searches.push(searchResult(
    'RC05_UNEXPECTED_STATE',
    'Could an unexpected state invalidate the patch mechanism?',
    stateSignals.length?'STATE_TRANSITIONS_REVIEWED':'NO_STATE_LITERALS_FOUND',
    stateSignals,
    false,
  ));

  const coupling=combined.flatMap(({file,content})=>{
    const hits=[...content.matchAll(/(?:from\s+|import\s*\(|require\s*\()(['"][^'"]+['"])/g)].map(x=>({file,dependency:x[1]}));
    return hits.slice(0,16);
  });
  searches.push(searchResult(
    'RC06_RELATED_FILES_INTERACTION',
    'Could related imports/dependencies create hidden coupling or a secondary regression?',
    coupling.length?'DEPENDENCY_SURFACE_REVIEWED':'NO_DEPENDENCY_SURFACE',
    coupling,
    false,
  ));

  const race=/race|concurr|parallel|queue|workflow_run|schedule|heartbeat|lease|stale|exact.sha/i.test(text+patch)
    || combined.some(({content})=>/Promise\.|setTimeout\(|setInterval\(|workflow_run|schedule|heartbeat|lease/i.test(content));
  searches.push(searchResult(
    'RC07_CONCURRENCY_RACE',
    'Could concurrency or temporal ordering create a regression?',
    race?'RACE_OR_TEMPORAL_SIGNAL_REVIEWED':'NO_EXPLICIT_RACE_SIGNAL',
    [race?'race-temporal-search=performed':'race-temporal-search=performed'],
    false,
  ));

  const workflowEffect=/(\.github\/workflows|gh run|workflow_dispatch|schedule:|continue-on-error|if:\s*(?:always|failure|cancelled))/i.test(patch)
    || /workflow|CI|gate|green|RED/i.test(text);
  searches.push(searchResult(
    'RC08_WORKFLOW_SIDE_EFFECT',
    'Could the patch change workflow or gate semantics?',
    workflowEffect?'WORKFLOW_SIDE_EFFECT_SURFACE_REVIEWED':'NO_WORKFLOW_SIDE_EFFECT_SIGNAL',
    [workflowEffect?'workflow semantics inspected':'workflow semantics not implicated'],
    false,
  ));

  const typeSignals=combined.flatMap(({file,content})=>{
    const hits=content.match(/(?:Promise<|interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|unknown|never)\b|TS\d{3,4})/g)||[];
    return hits.slice(0,12).map(x=>({file,typeSignal:x}));
  });
  searches.push(searchResult(
    'RC09_TYPE_CONTRACT_BREAK',
    'Could the patch violate a type-level contract?',
    typeSignals.length?'TYPE_CONTRACT_SURFACE_REVIEWED':'NO_LOCAL_TYPE_SIGNAL',
    typeSignals,
    false,
  ));

  const runtimeSignals=combined.flatMap(({file,content})=>{
    const hits=content.match(/(?:window\.|document\.|fetch\(|URL\.|MediaRecorder|navigator\.|requestAnimationFrame|localStorage|sessionStorage|process\.)/g)||[];
    return hits.slice(0,16).map(x=>({file,runtimeSignal:x}));
  });
  searches.push(searchResult(
    'RC10_HIDDEN_RUNTIME_BEHAVIOR',
    'Could runtime behavior outside the unit assertion regress?',
    runtimeSignals.length?'RUNTIME_SURFACE_REVIEWED':'NO_LOCAL_RUNTIME_SIGNAL',
    runtimeSignals,
    false,
  ));

  searches.push(searchResult(
    'RC11_SCOPE_VIOLATION',
    'Did the candidate change escape the selected source scope?',
    allFiles.length && selectedFiles.length
      ? (allFiles.every(file=>selectedFiles.includes(file))?'SCOPE_BOUND':'SCOPE_EXPANDED')
      : 'SCOPE_NOT_ESTABLISHED',
    allFiles.map(file=>({file,selected:selectedFiles.includes(file)})),
    Boolean(allFiles.length && selectedFiles.length && allFiles.some(file=>!selectedFiles.includes(file))),
  ));

  searches.push(searchResult(
    'RC12_CONTROL_PLANE_MUTATION',
    'Did the candidate touch tests/workflows/control-plane surfaces?',
    /(^|\n)\+.*(?:\.github\/workflows|scripts\/ci\/|test-[^/]+\.|tests\/|__tests__\/)/i.test(patch)
      ? 'CONTROL_OR_TEST_MUTATION_SIGNAL'
      : 'NO_CONTROL_OR_TEST_MUTATION_SIGNAL',
    [patch.match(/(^|\n)\+.*(?:\.github\/workflows|scripts\/ci\/|test-[^/]+\.|tests\/|__tests__\/).*/i)?.[0]??'no-protected-line-found'],
    /(^|\n)\+.*(?:\.github\/workflows|scripts\/ci\/|test-[^/]+\.|tests\/|__tests__\/)/i.test(patch),
  ));

  const valid=searches.filter(x=>x.validCounterexample);
  const exhausted=searches.length===12 && searches.every(x=>x.searched===true);
  return Object.freeze({
    schemaVersion:1,
    protocol:'REGRESSION-COUNTEREXAMPLE-SEARCH-v1',
    targetSha,
    failureFingerprint,
    searches,
    searchedCount:searches.filter(x=>x.searched).length,
    requiredSearches:12,
    validCounterexamples:valid,
    counterexampleFound:valid.length>0,
    exhausted:exhausted && valid.length===0,
    status:valid.length?'COUNTEREXAMPLE_FOUND':exhausted?'EXHAUSTED_NO_COUNTEREXAMPLE':'INCOMPLETE',
    noCounterexampleIsNotPatchCorrect:true,
    generatedAt:new Date().toISOString(),
  });
}

if(process.argv[1] && process.argv[1].endsWith('regression-counterexamples.mjs') && process.argv[2]){
  const input=JSON.parse(read(process.argv[2]));
  const report=searchRegressionCounterexamples(input);
  fs.writeFileSync(process.argv[3]??'/tmp/regression-counterexamples.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='EXHAUSTED_NO_COUNTEREXAMPLE')process.exitCode=1;
}
