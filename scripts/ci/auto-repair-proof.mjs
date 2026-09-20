const REQUIRED_PROOF_KEYS = Object.freeze([
  'reproductionWasFailing',
  'reproductionRecovered',
  'regressionPassed',
  'commandsPresent',
]);

export function validateRepairProof({ rootCauseProof, recurrenceProof, evidence } = {}) {
  const failures = [];
  if (!rootCauseProof || typeof rootCauseProof !== 'object') failures.push('root-cause-proof-missing');
  for (const key of REQUIRED_PROOF_KEYS) {
    if (rootCauseProof?.[key] !== true) failures.push(`root-cause-proof-${key}`);
  }
  if (recurrenceProof?.required !== true) failures.push('recurrence-proof-not-required');
  if (recurrenceProof?.firstPass !== true) failures.push('recurrence-proof-first-pass');
  if (recurrenceProof?.secondPass !== true) failures.push('recurrence-proof-second-pass');
  if (!evidence?.targetSha || !/^[a-f0-9]{40}$/u.test(evidence.targetSha)) failures.push('target-sha-missing');
  if (evidence?.reproductionSelection?.exact !== true) failures.push('verification-target-not-exact');
  if (evidence?.targetIdentity?.ok !== true) failures.push('verification-target-identity');
  if (evidence?.reproductionStability?.classification !== 'REPRODUCIBLE_FAILURE') failures.push('baseline-not-reproducible');
  if (evidence?.reproductionStabilityAfter?.classification !== 'STABLE_PASS') failures.push('post-repair-not-stable');
  if (evidence?.contaminationGuard?.ok !== true) failures.push('verification-contamination');
  if (evidence?.reproductionSelection?.testCreation !== 'DISABLED') failures.push('test-creation-not-disabled');
  if (!Array.isArray(evidence?.changedPaths)) failures.push('changed-paths-missing');
  if (!evidence?.diff || typeof evidence.diff !== 'object') failures.push('diff-evidence-missing');
  if (!evidence?.regression || evidence.regression.ok !== true) failures.push('regression-evidence-missing');
  return Object.freeze({ ok: failures.length === 0, failures });
}

export function preventionRuleFor({ fingerprint, rule } = {}) {
  return `Prevent recurrence of ${fingerprint ?? 'unknown-failure'} by retaining verified rule ${rule ?? 'unknown-rule'} and requiring the same proof contract before closure.`;
}

export function escalationReason(proof) {
  if (proof?.failures?.length) return `repair-proof-incomplete:${proof.failures.join(',')}`;
  return 'repair-proof-complete';
}
