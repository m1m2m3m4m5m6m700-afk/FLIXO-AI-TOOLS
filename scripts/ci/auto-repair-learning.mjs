  const isHistoricalRevertFailure = outcome === 'revert-failure';
  if (isExternalBlock) entry.externalBlocks = (entry.externalBlocks ?? 0) + 1;
  if (isHistoricalRevert) {
    entry.reversions = (entry.reversions ?? 0) + 1;
    if (rule) entry.revertedRules = [...new Set([...(entry.revertedRules ?? []), rule])];
    if (/^[a-f0-9]{40}$/u.test(String(provenance?.revertedCommit ?? ''))) entry.revertedCommits = [...new Set([...(entry.revertedCommits ?? []), provenance.revertedCommit])];
  }
  if (isHistoricalRevertFailure) entry.revertFailures = (entry.revertFailures ?? 0) + 1;
  const countsAsRepairAttempt = ['success', 'unrepaired', 'failure', 'blocked'].includes(outcome);
  if (countsAsRepairAttempt) {
    entry.attempts += 1;
    const persistedAttempts = priorRepairArtifactCount() + 1;
    if (persistedAttempts > entry.attempts) entry.attempts = persistedAttempts;
  }
  if (outcome === 'success') entry.successes += 1; else if (countsAsRepairAttempt) entry.failures += 1;
  entry.confidence = confidenceFor(entry);
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, provenance: effectiveProvenance, diagnosis: effectiveDiagnosis, preventionRule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-MEMORY_RETENTION.maxCaseOutcomes);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  const countsAsPlaybookAttempt = ['success', 'unrepaired', 'failure', 'blocked'].includes(outcome);
  const actionRecord = memory.actionHistory.find((item) => item.fingerprint === fingerprint) ?? {
    fingerprint,
    rootCause: entry.rootCause,
    attempts: 0,
    successes: 0,
    failures: 0,
    occurrences: 0,
    strategies: [],
    rejectedStrategies: [],
    rules: [],
    doNotRepeat: [],
    evidence: [],
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: null,
  };
  actionRecord.rootCause = entry.rootCause;
  actionRecord.occurrences = Number(actionRecord.occurrences ?? 0) + 1;
  actionRecord.lastSeenAt = new Date().toISOString();
  if (countsAsPlaybookAttempt) actionRecord.attempts = Number(actionRecord.attempts ?? 0) + 1;
  if (outcome === 'success') actionRecord.successes = Number(actionRecord.successes ?? 0) + 1;
  if (['failure', 'unrepaired', 'blocked', 'reverted-repair', 'revert-failure'].includes(outcome)) actionRecord.failures = Number(actionRecord.failures ?? 0) + 1;
  const observedStrategy = strategyId ?? provenance?.strategyId ?? null;
  if (observedStrategy) {
    actionRecord.strategies = [...new Set([...(actionRecord.strategies ?? []), observedStrategy])].slice(-20);
    if (outcome !== 'success') actionRecord.rejectedStrategies = [...new Set([...(actionRecord.rejectedStrategies ?? []), observedStrategy])].slice(-20);
  }
  if (rule) actionRecord.rules = [...new Set([...(actionRecord.rules ?? []), rule])].slice(-20);
  if (outcome !== 'success' && rule) actionRecord.doNotRepeat = [...new Set([...(actionRecord.doNotRepeat ?? []), rule])].slice(-50);
  if (effectiveProvenance?.failedSha || effectiveProvenance?.targetSha || verification) {
    actionRecord.evidence = [...(actionRecord.evidence ?? []), {
      outcome,
      verification,
      strategyId: observedStrategy,
      failedSha: effectiveProvenance?.failedSha ?? null,
      targetSha: effectiveProvenance?.targetSha ?? null,
      runId: effectiveProvenance?.runId ?? null,
      diagnosis: effectiveDiagnosis,
      affectedPaths: effectiveDiagnosis?.affectedPaths ?? [],
      at: new Date().toISOString(),
    }].slice(-MEMORY_RETENTION.maxLessonEvidence);
  }
  const historyIndex = memory.actionHistory.findIndex((item) => item.fingerprint === fingerprint);
  if (historyIndex >= 0) memory.actionHistory[historyIndex] = actionRecord;
  else memory.actionHistory.push(actionRecord);
  memory.actionHistory = memory.actionHistory.slice(-MEMORY_RETENTION.maxActionHistory);

  if (rule && countsAsPlaybookAttempt) {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule) ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0, fingerprints: [], successfulFingerprints: [], failedFingerprints: [] };
    playbook.attempts += 1;
    playbook.fingerprints = [...new Set([...(playbook.fingerprints ?? []), fingerprint])];
    if (outcome === 'success') {
      playbook.successes += 1;
      playbook.successfulFingerprints = [...new Set([...(playbook.successfulFingerprints ?? []), fingerprint])];
    } else {
      playbook.failures += 1;
      playbook.failedFingerprints = [...new Set([...(playbook.failedFingerprints ?? []), fingerprint])];
    }
    playbook.successRate = Number((playbook.successes / playbook.attempts).toFixed(4));
    playbook.generalized = new Set(playbook.successfulFingerprints ?? []).size >= 2 && playbook.successes >= 2 && playbook.successRate >= 0.8;
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  if (outcome === 'success' || outcome === 'unrepaired' || outcome === 'failure' || outcome === 'blocked' || outcome === 'blocked-external') {
    upsertLesson(memory, { fingerprint, rootCause: entry.rootCause, rule, outcome, verification, provenance: effectiveProvenance, preventionRule });
  }
  const cellKnowledge = buildKnowledgeRecord({
    botId: process.env.FLIXO_CELL_BOT_ID ?? null,
    taskId: process.env.FLIXO_TASK_ID ?? provenance?.taskId ?? null,
    taskShortName: process.env.FLIXO_CELL_TASK_SHORT_NAME ?? null,
    taskName: process.env.FLIXO_CELL_TASK_NAME ?? null,
    fingerprint,
    rootCause: entry.rootCause,
    rule,
    outcome,
    verification,
    targetSha: effectiveProvenance?.targetSha ?? process.env.FLIXO_TARGET_SHA ?? null,
    failedSha: effectiveProvenance?.failedSha ?? process.env.FLIXO_FAILED_SHA ?? null,
    runId: effectiveProvenance?.runId ?? process.env.FLIXO_RUN_ID ?? null,
    source: 'FLIXO Error Memory / Cell Learning',