# FLIXO Autonomous Execution Control Plan

> Purpose: persistent execution memory for repository work. This file is the authoritative checklist for the current implementation campaign.
> Rule: before starting a task, read this file; after completing or failing a task, update it with evidence. Never infer that a tool, file, test, API, or capability exists without verifying it.

## 0. Operating Contract

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`
- Target branch: `codex/ci-architecture-hardening`
- Base branch: `main`
- Current PR: #875
- Production authority: human command required.
- Agent autonomy: disabled at production execution boundary.
- No autonomous self-modification, self-delegation, or uncontrolled retry loops.
- No claim of test/CI success without an observed result.
- No claim that a file/tool/API exists until repository/tool discovery confirms it.
- Shared contracts belong in `packages/contracts`; orchestration implementations belong in `packages/agent-orchestrator`.
- Every task must end in one of: COMPLETE, BLOCKED, FAILED, or DEFERRED.
- Every COMPLETE task requires a concrete verification record.

## 1. Verified Tool Inventory

Verified available repository operations in this session:
- GitHub repository metadata
- GitHub file read
- GitHub file create/update/delete
- GitHub branch creation/update
- GitHub commit/workflow inspection
- GitHub PR inspection/update
- GitHub code/file search

Not assumed available:
- local shell execution
- local npm/pnpm execution
- local filesystem access to repository
- successful CI execution
- merge permission
- production deployment permission

Rule: if a required operation is not in the verified inventory, discover it before planning around it.

## 2. Current Repository State

- Default branch: `main`
- Active implementation branch: `codex/ci-architecture-hardening`
- PR #875 is open and currently reported mergeable.
- Last observed PR head before this control file: `16b5c9fc9da0f35aef8451085320239456d1fa49`
- Latest CI result for that head: not yet established in this session.
- Local test execution: not established.

## 3. Completed Work Ledger

### C01 — Architecture hardening
Status: COMPLETE
Evidence: architecture gate, workspace/orchestrator boundaries, CI hardening were implemented in prior commits.
Verification: repository history and current branch state previously inspected.

### C02 — Agent network / supervised execution
Status: COMPLETE
Evidence: `packages/agent-orchestrator/src/network.ts`, `src/index.ts`.
Verification: repository tests were added; CI verification remains authoritative.

### C03 — Adversarial / RED Team layer
Status: COMPLETE
Evidence: `src/adversarial.ts`, `src/red-team.ts`, reward extensions and tests.
Verification: tests exist; CI result must still be observed before declaring CI-pass.

### C04 — Cognitive observability
Status: COMPLETE
Evidence: `src/cognitive.ts`, contracts, cognitive tests, orchestrator integration.
Verification: source and tests inspected.

### C05 — Failure intelligence + confidence calibration
Status: COMPLETE
Evidence: `FailureIntelligence`, `ConfidenceCalibrator`, orchestrator wiring, tests.
Verification: source and tests inspected; CI pending/unknown until observed.

### C06 — Skill Memory + adaptive curriculum
Status: COMPLETE
Evidence: `src/continual-learning.ts`, skill-driven curriculum test.
Verification: source and test files inspected; CI pending/unknown until observed.

## 4. Execution Roadmap

### P0 — Control-plane integrity
Status: IN PROGRESS
Goal: make this file the persistent execution state and eliminate source/plan drift.
Tasks:
- P0.1 Create/update this control plan.
- P0.2 Record exact branch/head and verified tool inventory.
- P0.3 Record every subsequent task result here.

Exit condition: this file exists on the active branch and is updated after each task.

### P1 — Objective verification
Status: COMPLETE
Goal: prevent agents from receiving learning credit from self-reported success.
Tasks:
- P1.1 Define verification contracts in `packages/contracts`.
- P1.2 Implement verifier interface and deterministic evidence checks.
- P1.3 Separate raw agent claims from verified outcomes. COMPLETE — orchestrator now attaches an independent `ObjectiveVerificationContract` to reports before observer/learning consumption.
- P1.4 Add tests for pass, fail, unresolved, malformed evidence. COMPLETE for pass/fail/unresolved coverage; malformed-evidence coverage remains limited by the current structured TypeScript evidence surface.
- P1.5 Connect verifier results to reward and cognitive verification state. COMPLETE — learning and continual-learning use `calculateVerified`; cognitive state/calibration use verifier status.

P1.1 result: COMPLETE — added `ObjectiveVerificationContract` and `ObjectiveVerificationStatus` to `packages/contracts/src/index.ts` after inspecting the existing contract surface. No duplicate verifier implementation was added.
Verification: GitHub file read confirmed the contract was written to the active branch.

P1.2 result: COMPLETE — added deterministic `ObjectiveVerifier`, exported it from the orchestrator, and added dedicated tests for verified, rejected, and missing-evidence cases.
Verification: source and test files were created and the package test script was updated. Runtime execution is not yet verified because no local shell runner has been established in this session.

Exit condition:
- no reward promotion without an explicit verification result;
- unresolved results cannot be treated as success;
- tests cover pass/fail/unresolved evidence; malformed input coverage remains a follow-up.

### C07 — Objective verification gate
Status: COMPLETE
Evidence: `ObjectiveVerifier`, `DirectCommandOrchestrator.verifyReport`, `AgentRewardEngine.calculateVerified`, `AgentLearningObserver`, and `ContinualLearningEngine`.
Verification: source files re-read from the active branch after writes; dedicated unresolved-verification and reward-gate tests were added. Local test execution remains unestablished, so CI/test pass is not claimed.
Known limitation: `AgentRewardEngine.calculate()` remains available as a low-level raw calculation API for compatibility; production learning paths must use `calculateVerified()`.

### P2 — Failure intelligence hardening
Status: PLANNED
Goal: turn failures into structured learning signals.
Tasks:
- P2.1 Normalize failure taxonomy.
- P2.2 Add recurrence/severity aggregation.
- P2.3 Connect recurring failures to curriculum focus.
- P2.4 Add regression tests.

Exit condition: curriculum can target a verified recurring failure pattern.

### P3 — Skill memory
Status: PARTIAL / IMPLEMENTED
Goal: represent reusable capabilities derived from verified experience.
Tasks:
- P3.1 Skill record and proficiency.
- P3.2 Verified sample tracking.
- P3.3 Strength/weakness extraction.
- P3.4 Skill-driven curriculum.
- P3.5 Add skill regression tests.

Remaining: strengthen persistence/integration with failure and verification records.

### P4 — Adaptive challenge generation
Status: PLANNED
Goal: generate bounded challenges from actual weaknesses and mastery.
Tasks:
- P4.1 Define challenge contract.
- P4.2 Deterministic challenge templates.
- P4.3 Difficulty adaptation.
- P4.4 Objective scoring.
- P4.5 Challenge provenance.
- P4.6 Challenge tests.

Exit condition: every generated challenge has objective acceptance criteria.

### P5 — Learning loop
Status: PLANNED
Goal: close the loop: execution -> evidence -> verification -> reward -> skill/failure memory -> curriculum -> next challenge.
Tasks:
- P5.1 Persist verified experience.
- P5.2 Feed verified failure patterns to curriculum.
- P5.3 Calibrate confidence against verified outcomes.
- P5.4 Prevent unverified experience from improving mastery.
- P5.5 Add end-to-end learning tests.

Exit condition: a failed run measurably changes the next curriculum item.

### P6 — Adversarial learning
Status: PARTIAL / IMPLEMENTED
Goal: use independent critics without leaking opponent answers.
Tasks:
- P6.1 Preserve primary/adversary isolation.
- P6.2 Feed adjudication feedback into later rounds without exposing raw opponent output.
- P6.3 Evaluate critic false positives.
- P6.4 Persist adversarial reward into learning memory.
- P6.5 Add multi-round regression tests.

Exit condition: adversarial feedback changes subsequent evaluation while isolation remains intact.

### P7 — Evolution governor
Status: PLANNED
Goal: allow bounded improvement proposals without granting production authority.
Tasks:
- P7.1 Define proposal/archive contract.
- P7.2 Sandbox mutation model.
- P7.3 Benchmark gate.
- P7.4 Human promotion gate.
- P7.5 Rollback metadata.

Exit condition: no evolved change can reach production without explicit promotion.

### P8 — Production integration
Status: PLANNED
Goal: connect the learning system to real FLIXO execution without weakening command authority.
Tasks:
- P8.1 Map real tools to supervised workers.
- P8.2 Map provider/model router to model invoker.
- P8.3 Replace duplicated provider HTTP logic where appropriate.
- P8.4 Wire persistent storage only after schema/security verification.
- P8.5 Add observability and rollback.

Exit condition: production execution remains human-command-gated and every material action is auditable.

### P9 — Full verification
Status: PLANNED
Goal: prove repository state rather than assume it.
Tasks:
- P9.1 Typecheck all affected packages.
- P9.2 Unit tests.
- P9.3 Architecture gate.
- P9.4 Agent Editor build/lint/E2E.
- P9.5 GitHub Actions result inspection.
- P9.6 Review diff and PR mergeability.
- P9.7 Record unresolved limitations.

Exit condition: all required checks have observed successful results, not merely configured commands.

## 5. Anti-Hallucination Ledger

For every future task record:
- What was assumed before discovery.
- What was actually found.
- Files changed.
- Tool/API used.
- Verification performed.
- Exact result.
- Remaining uncertainty.

Never write “implemented” when only a plan exists.
Never write “tested” when tests were only authored.
Never write “passed” when CI is pending.
Never write “production-ready” while required verification is missing.

## 6. Current Next Action

Execute P2.1: normalize failure taxonomy and connect verified failure patterns to curriculum focus. After that, implement P4/P5/P6 in sequence, then production integration and full verification.

Fine-tuning track: treat verified experiences as the only eligible training-data source; do not introduce model-weight updates until dataset provenance, objective verification, benchmark gates, sandboxing, and human promotion controls are implemented.
