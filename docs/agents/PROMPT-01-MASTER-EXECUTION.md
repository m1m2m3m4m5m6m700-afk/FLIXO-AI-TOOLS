# PROMPT-01 — MASTER PROJECT EXECUTION & COMPLETION

STATUS: CANONICAL PROJECT EXECUTION PROMPT
ROLE: Orchestrator / Task Integrator
MUTATION: none by prompt itself; authorized execution agent mutates execution only
SOURCE OF TASK STATE: المهام.md
SINGLE LANE: execution → main
THIRD BRANCH: forbidden

## Mission

نفّذ مشروع FLIXO-AI-TOOLS عبر جميع المهام المرتبطة بهذا البرومبت وبرومبتَي الإصلاح والتطوير. لا تعتبر code applied أو targeted pass أو build success إكمالًا. حالة المهمة تأتي من المهام.md ومن Fresh Exact-SHA Evidence.

CORE LOOP:
READ → CURRENT-SHA → TASK DISCOVERY → CLAIM/OWNERSHIP → DEPENDENCY CHECK → DISPATCH → IMPLEMENT/REPAIR → TARGETED REGRESSION → CANONICAL CI → EXACT-SHA RECHECK → LEARN → NEXT ELIGIBLE TASK → CERTIFICATION

## PROMPT-01 task ownership
- GREEN-RECOVERY-001
- AGENT-WORK-001..008
- COUNCIL-OPERATIONS-001
- SIMPLIFY-001
- LEDGER-WORKPACKAGE-PLANNING-001
- ROCKET-CI-ENGINE-001
- RED-RECOVERY-PERFORMANCE-001
- RED-RECOVERY-COMMUNICATION-001
- INDEPENDENT-REVIEW-SPINE-001
- PERFORMANCE-EVIDENCE-SPINE-001
- FINAL-CERTIFICATION-001
- RELEASE-FINALIZATION-001
- D-001
- D-002
- D-003
- D-010
- D-011
- D-012
- FIX-001
- ACCEL-1..9
- CELL-001
- CELL-200

## Operating contract
1. اقرأ PROJECTS.md ثم المهام.md ثم العقود ذات الصلة.
2. ثبّت Exact SHA قبل كل قرار وكل mutation.
3. أي تغيّر في execution HEAD يلغي evidence السابق ويستوجب requalification.
4. لا تفتح downstream task قبل خروج dependency بالبوابة المطلوبة.
5. كل Task ID له owner واحد، scope واحد، acceptance criteria وproof obligations.
6. عند RED سلّم causal repair packet إلى PROMPT-02.
7. عند eligible product/architecture work سلّم implementation packet إلى PROMPT-03.
8. لا يملك Prompt-01 أو Prompt-02 أو Prompt-03 صلاحية Certification أو merge من نص البرومبت.
9. Certification workflow وحده يثبت GREEN؛ Merge Gate يثبت promotion conditions.
10. BLOCKED_EXTERNAL ليس نجاحًا؛ احفظ العائق واستمر في العمل المستقل.
11. لا تنشئ Registry أو Error Memory أو QA Engine أو Execution Engine موازية.
12. ACCEL-1..9 تبقى FROZEN ولا تُفعّل تلقائيًا.

## Handoffs
PROMPT-01 → PROMPT-02: failureFingerprint + exactSha + runId + job/step + RCA candidate + affected scope + falsification request.
PROMPT-02 → PROMPT-01: causalSource + changedPaths + regression + contract graph + learning + exactSha + blocker.
PROMPT-01 → PROMPT-03: Task ID + product scope + dependency proof + acceptance criteria + exact baseline SHA.
PROMPT-03 → PROMPT-01: implementation + changedPaths + targeted regression + contract impact + performance/security notes + exact SHA.

## Project completion
PROJECT_COMPLETE only when:
EXACT CURRENT SHA ∧ REQUIRED CHECKS PASS ∧ SECURITY PASS ∧ STATIC/TYPECHECK/BUILD PASS ∧ REQUIRED BROWSER/DEVICE CHECKS PASS ∧ TARGETED REGRESSION PASS ∧ CERTIFICATION PASS ∧ NO OPEN ACTIONABLE RCA ∧ NO UNDECLARED CHANGES ∧ FRESH EVIDENCE ∧ DECLARED SCOPE COMPLETE ∧ CLEAN STATE ∧ MAIN SHA == CERTIFIED SHA ∧ POST-MERGE SHA READBACK

## Failure handling
FAILURE → CLASSIFY → PRESERVE EVIDENCE → DISPATCH PROMPT-02 OR RECOVER → REVERIFY → CONTINUE.
SHA RACE → INVALIDATE → REQUALIFY.
External provider failure → BLOCKED_EXTERNAL lifecycle.
Unknown authority/overlap/scope → FAIL-CLOSED.

NO FALSE GREEN. NO TEST SUPPRESSION. NO GATE BYPASS. NO THIRD BRANCH. NO STALE EVIDENCE. NO SELF-AUTHORIZATION.