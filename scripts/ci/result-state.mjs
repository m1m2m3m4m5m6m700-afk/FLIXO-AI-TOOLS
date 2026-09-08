export const EXECUTION_STATES = Object.freeze([
  'NOT_STARTED',
  'RUNNING',
  'PASS',
  'FAIL',
  'CANCELLED',
  'BLOCKED',
  'NOT_EXECUTED',
  'MISSING_EVIDENCE',
  'MALFORMED_EVIDENCE',
]);

export function isTerminalSuccess(state) {
  return state === 'PASS';
}

export function isExecutionFailure(state) {
  return state === 'FAIL' || state === 'BLOCKED' || state === 'CANCELLED' || state === 'NOT_EXECUTED';
}

export function isEvidenceFailure(state) {
  return state === 'MISSING_EVIDENCE' || state === 'MALFORMED_EVIDENCE';
}

export function assertExecutionState(state) {
  if (!EXECUTION_STATES.includes(state)) throw new Error(`Invalid execution state: ${state}`);
  return state;
}

export function reduceCheckResults(checks, expected) {
  const normalized = checks.map((check) => ({ ...check, status: assertExecutionState(check.status) }));
  const counts = Object.fromEntries(EXECUTION_STATES.map((state) => [state, normalized.filter((check) => check.status === state).length]));
  const executed = counts.PASS + counts.FAIL;
  const decision =
    normalized.length === expected &&
    counts.FAIL === 0 &&
    counts.BLOCKED === 0 &&
    counts.CANCELLED === 0 &&
    counts.NOT_EXECUTED === 0 &&
    counts.MISSING_EVIDENCE === 0 &&
    counts.MALFORMED_EVIDENCE === 0 &&
    counts.PASS === expected;
  return { status: decision ? 'PASS' : 'FAIL', counts, executed, expected, decision };
}
