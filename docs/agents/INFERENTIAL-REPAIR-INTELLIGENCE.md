# FLIXO Inferential Repair Intelligence

## Purpose

The repository has a deterministic inference fallback for cases where literal error matching does not yield a sufficiently specific repair hypothesis.

The layer is evidence-bounded. It does not replace the Error Agent, the Repair Control Plane, adversarial review, exact-SHA reproduction, or Canonical CI.

## Inputs

\`inference-fallback.mjs\` combines:

- normalized current failure text and extracted features;
- real historical GitHub Actions error records from \`docs/agents/historical-action-errors\`;
- successful repair playbooks;
- lessons and anti-lessons;
- the current target SHA;
- the current diagnosis, when one exists.

## Inference modes

\`KNOWN_STRATEGY_TRANSFER\` reuses a validated repair pattern across a different failure fingerprint.

\`CROSS_CASE_SYNTHESIS\` combines historical similarity with playbook success evidence to form a new bounded hypothesis.

\`NEW_HYPOTHESIS\` records that evidence is insufficient for a safe mutation and keeps the result proposal-only.

## Prediction

Historical error-class transitions can be used to predict likely next failure classes. This is prioritization/triage intelligence, not proof.

Prediction never authorizes a repair by itself.

## Mutation safety

An inferred repair may become mutation-eligible only when all required evidence conditions hold, including:

- exact current SHA is known;
- historical support covers multiple successful fingerprints;
- successful playbook rate is sufficiently high;
- no blocking anti-lesson/reverted rule applies;
- current evidence supports the inferred class;
- confidence and evidence diversity cross the configured thresholds;
- exact failure reproduction and downstream verification still pass.

The final authority remains Canonical CI on the exact resulting SHA.

## Adversarial interaction

The read-only sibling receives the same inference result and may challenge the inferred hypothesis, strategy and predicted outcome.

A challenge cannot grant mutation authority.

## Learning loop

\`\`\`text
Current RED
  ↓
Literal diagnosis
  ↓
No reliable direct match
  ↓
Inference fallback
  ↓
Historical similarity + playbooks + lessons/anti-lessons
  ↓
Hypothesis / prediction
  ↓
Read-only adversarial challenge
  ↓
Exact-SHA reproduction
  ↓
Bounded repair
  ↓
Targeted regression
  ↓
Canonical CI
  ↓
Verified learning outcome
  ↓
Historical index update
\`\`\`

Memory is a prior. The current repository state is the evidence.
