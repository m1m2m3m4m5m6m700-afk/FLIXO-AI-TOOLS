export type AgentObservation = Readonly<{
  kind: 'INPUT' | 'PLAN' | 'TOOL' | 'RESULT' | 'ERROR' | 'STATE';
  signature: string;
}>;

export type StuckSeverity = 'NONE' | 'SUSPECTED' | 'STUCK';

export type StuckAssessment = Readonly<{
  severity: StuckSeverity;
  repeatedSignature?: string;
  repeatCount: number;
  alternating: boolean;
  reason: string;
  recommendation: 'CONTINUE' | 'REFLECT' | 'REPLAN' | 'FAIL_CLOSED';
}>;

const normalizeSignature = (value: string): string =>
  value.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ').slice(0, 512);

function isAlternating(observations: readonly AgentObservation[], windowSize: number): boolean {
  if (observations.length < windowSize || windowSize < 4) return false;
  const recent = observations.slice(-windowSize).map((item) => normalizeSignature(item.signature));
  const a = recent[0];
  const b = recent[1];
  if (!a || !b || a === b) return false;
  return recent.every((value, index) => value === (index % 2 === 0 ? a : b));
}

export function assessAgentStuck(
  observations: readonly AgentObservation[],
  options: Readonly<{ repeatThreshold?: number; alternatingWindow?: number }> = {},
): StuckAssessment {
  const repeatThreshold = Math.max(2, Math.min(8, Math.floor(options.repeatThreshold ?? 3)));
  const alternatingWindow = Math.max(4, Math.min(10, Math.floor(options.alternatingWindow ?? 6)));
  if (observations.length === 0) {
    return Object.freeze({ severity: 'NONE', repeatCount: 0, alternating: false, reason: 'NO_OBSERVATIONS', recommendation: 'CONTINUE' });
  }

  const counts = new Map<string, number>();
  for (const observation of observations.slice(-32)) {
    const signature = normalizeSignature(observation.signature);
    if (!signature) continue;
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  let repeatedSignature: string | undefined;
  let repeatCount = 0;
  for (const [signature, count] of counts) {
    if (count > repeatCount) {
      repeatedSignature = signature;
      repeatCount = count;
    }
  }

  const alternating = isAlternating(observations, alternatingWindow);

  if (alternating) {
    return Object.freeze({
      severity: 'STUCK',
      repeatedSignature,
      repeatCount,
      alternating: true,
      reason: 'ALTERNATING_ACTION_OBSERVATION_LOOP',
      recommendation: 'REPLAN',
    });
  }

  if (repeatCount >= repeatThreshold) {
    const last = observations.at(-1)?.kind;
    const recommendation = last === 'ERROR' ? 'FAIL_CLOSED' : 'REFLECT';
    return Object.freeze({
      severity: 'STUCK',
      repeatedSignature,
      repeatCount,
      alternating: false,
      reason: 'REPEATED_AGENT_BEHAVIOR',
      recommendation,
    });
  }

  if (repeatCount === repeatThreshold - 1) {
    return Object.freeze({
      severity: 'SUSPECTED',
      repeatedSignature,
      repeatCount,
      alternating: false,
      reason: 'REPEATED_BEHAVIOR_THRESHOLD_APPROACHING',
      recommendation: 'REFLECT',
    });
  }

  return Object.freeze({
    severity: 'NONE',
    repeatedSignature,
    repeatCount,
    alternating: false,
    reason: 'NO_STUCK_PATTERN',
    recommendation: 'CONTINUE',
  });
}
