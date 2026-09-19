export function buildCausalProof({diagnosis=null,plan=null,simulation=null,reproductionBefore=null,reproductionAfter=null,regression=null,recurrenceProof=null,changedPaths=[],selfCritic=null}={}){
  const failures=[];
  const beforeFailed=reproductionBefore?.results?.length>0&&reproductionBefore?.ok===false;
  const afterRecovered=reproductionAfter?.results?.length>0&&reproductionAfter?.ok===true;
  const regressionPassed=regression?.ok===true;
  const recurrencePassed=recurrenceProof?.firstPass===true&&recurrenceProof?.secondPass===true;
  const sourceLinked=Boolean(plan?.file&&changedPaths.includes(plan.file)&&(!diagnosis?.location?.file||diagnosis.location.file===plan.file));
  const hypothesisSeparated=diagnosis?.mutationGate?.hypothesisSeparation===true||(diagnosis?.secondHypothesis==null&&Number(diagnosis?.causalConfidence??0)>=0.75);
  if(!beforeFailed)failures.push('CAUSAL_REPRODUCTION_BEFORE_NOT_FAILING');
  if(!afterRecovered)failures.push('CAUSAL_REPRODUCTION_NOT_RECOVERED');
  if(!regressionPassed)failures.push('CAUSAL_REGRESSION_NOT_PASSED');
  if(!recurrencePassed)failures.push('CAUSAL_RECURRENCE_NOT_PROVEN');
  if(!simulation?.ok)failures.push('CAUSAL_SIMULATION_NOT_PROVEN');
  if(!selfCritic?.ok)failures.push('CAUSAL_SELF_CRITIC_NOT_PASSED');
  if(!sourceLinked)failures.push('CAUSAL_SOURCE_LINK_NOT_PROVEN');
  if(!hypothesisSeparated)failures.push('CAUSAL_HYPOTHESIS_SEPARATION_NOT_PROVEN');
  return Object.freeze({schemaVersion:1,mechanismProven:failures.length===0,reproduction:{beforeFailed,afterRecovered,recurrence:recurrencePassed},simulationPassed:simulation?.ok===true,selfCriticPassed:selfCritic?.ok===true,sourceLinked,hypothesisSeparated,confidence:Number(diagnosis?.causalConfidence??0),failures,ok:failures.length===0});
}
