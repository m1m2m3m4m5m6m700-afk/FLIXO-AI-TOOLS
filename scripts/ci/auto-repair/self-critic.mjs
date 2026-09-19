const BYPASS_PATTERNS=Object.freeze([
  /test\.(?:skip|only)\b/i,
  /(?:describe|it)\.(?:skip|only)\b/i,
  /eslint-disable/i,
  /@ts-(?:ignore|nocheck)/i,
  /coverage\s*(?:ignore|exclude)/i,
  /playwright.*(?:skip|fixme)/i,
]);
export function critiqueRepair({diff='',diffSummary=null,plan=null,diagnosis=null,simulation=null,maxChangedFiles=8,maxChangedLines=300}={}){
  const blockers=[],warnings=[],changedFiles=diffSummary?.files??[];
  const addedLines=String(diff??'').split(/\r?\n/).filter(line=>line.startsWith('+')&&!line.startsWith('+++'));
  if(!simulation?.ok)blockers.push('SELF_CRITIC_SIMULATION_NOT_PROVEN');
  if(!changedFiles.length)blockers.push('SELF_CRITIC_EMPTY_DIFF');
  if(changedFiles.length>maxChangedFiles)blockers.push('SELF_CRITIC_FILE_SCOPE_EXCEEDED');
  if(Number(diffSummary?.lines??0)>maxChangedLines)blockers.push('SELF_CRITIC_LINE_SCOPE_EXCEEDED');
  if(plan?.targetScope==='exact-file'&&plan.file&&!changedFiles.includes(plan.file))blockers.push('SELF_CRITIC_TARGET_FILE_NOT_CHANGED');
  if(diagnosis?.location?.file&&!changedFiles.includes(diagnosis.location.file))warnings.push('SELF_CRITIC_REPORTED_LOCATION_NOT_IN_DIFF');
  const bypasses=addedLines.filter(line=>BYPASS_PATTERNS.some(pattern=>pattern.test(line)));
  if(bypasses.length)blockers.push('SELF_CRITIC_GATE_BYPASS_DETECTED');
  const risk=blockers.length?'BLOCKED':warnings.length?'CAUTION':Number(diffSummary?.lines??0)>Math.max(40,maxChangedLines*0.25)?'ELEVATED':'BOUNDED';
  return Object.freeze({schemaVersion:1,ok:blockers.length===0,verdict:blockers.length?'REJECT':'ACCEPT',risk,blockers,warnings,bypasses,changedFiles,changedLines:Number(diffSummary?.lines??0),target:plan?.file??null,simulationPassed:simulation?.ok===true});
}
