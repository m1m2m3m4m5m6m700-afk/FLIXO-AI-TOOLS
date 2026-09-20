# FLIXO Repair Bot — Teaching Sessions

These sessions form the persistent teaching curriculum for the autonomous repair bot.

Core loop: RED → fingerprint → history → teaching session → strategy → repair → exact-SHA verification → canonical GREEN → lesson.

1. Exact-SHA Truth — stale evidence never proves current GREEN.
2. RED to Root Cause — distinguish symptom from cause.
3. Strategy Memory — do not repeat rejected strategies without a changed hypothesis.
4. Unified Gate — one canonical GREEN authority; specialized checks are diagnostics.
5. Repair Authority — mutate execution only; preserve main.
6. False-Green Defense — stale/skipped/cancelled/incomplete evidence is NOT PROVEN.
7. Successful Repair Memory — retain strategy, change, SHA, and verification.
8. Repeated RED Escalation — persistent RED requires new evidence or hypothesis.
9. Historical Learning — reuse history only when applicability is demonstrated.
10. Proof Closure — exact-target verification plus fresh canonical GREEN.

Teaching invariant: the bot is taught to repair RED, not manufacture GREEN.
Closure state: OPEN_UNTIL_PROVEN.

## 100-lesson reinforcement curriculum — added 2026-09-20

11. Exact-SHA Single Source — Every repair claim must name the exact commit SHA it was proved against.
12. SHA Invalidates Evidence — A new commit invalidates all prior certification evidence, even when the code change is documentation-only.
13. Fail Closed on Race — When observed SHA differs from expected SHA, invalidate the evidence instead of interpreting it.
14. Requalify After Mutation — Every mutation requires a fresh canonical verification cycle.
15. Earliest RED First — Repair the first causally authoritative failing gate before downstream failures.
16. Downstream Is Not Root — Certification or browser failures may be secondary symptoms of an earlier static defect.
17. CodeQL Detail First — Never patch a security RED from the title alone; obtain the sink, source, rule, and exact path.
18. Preserve Security Semantics — Never weaken a gate, suppress an alert, or narrow a scan merely to get GREEN.
19. DOM Sink Awareness — User-controlled text reaching HTML/DOM interpretation is a security boundary, not ordinary UI data.
20. Render Text, Not Markup — Prefer React text nodes over raw HTML injection for untrusted or indirectly controlled content.
21. Trusted Label Isolation — When a value comes from a registry, display a separately resolved trusted label rather than propagating the raw selector.
22. Registry Before Rendering — Resolve identifiers against the canonical registry before exposing derived display data.
23. URL Encoding Is Not Trust — Encoding a value for a URL does not make the value trusted for other sinks.
24. Reduce Sink Surface — If a display path is unnecessary, remove the dynamic text from the DOM instead of trying to sanitize it.
25. Download Safety — Prefer React-managed download links and lifecycle-managed Blob URLs over imperative anchor creation.
26. Blob URL Lifecycle — Revoke object URLs deterministically and clear their references on replacement and unmount.
27. Hook Purity — Do not call state setters merely to mirror values inside effects when the state can be derived directly.
28. Render Determinism — Do not call time, random, or other impure generators during render when lint enforces purity.
29. Static Filenames — Deterministic download filenames are safer and more testable than render-time timestamps.
30. Security Fix Scope — Change the smallest source surface that removes the proven sink; avoid unrelated refactors.
31. Artifact Is Data — Never treat downloaded artifacts as inherently trusted because the download succeeded.
32. Artifact Integrity — Bind security-sensitive artifacts to expected workflow, run, source SHA, schema, and bounded size.
33. Producer Identity — Verify the expected producer workflow/run before consuming an artifact in a privileged job.
34. Immutable Source — A successful artifact lookup is insufficient without proving its source identity.
35. Dispatch Boundary — Workflow-dispatch inputs must never become implicit authority inside privileged repair logic.
36. Fixed Artifact Names — Prefer internally fixed artifact names over caller-controlled artifact path selection.
37. Bounded Payloads — Reject oversized serialized repair inputs before parsing or executing them.
38. Schema Before Semantics — Validate artifact structure before trusting any field extracted from it.
39. Read-Only Fields — Treat provenance fields as immutable evidence, not editable input fields.
40. No Attacker-Controlled Authority — External content may provide evidence, never certification authority.
41. Environment Injection Boundary — Values derived from workflow inputs must not flow unchecked into environment variables.
42. GITHUB_ENV Is Sensitive — Writing untrusted text to GITHUB_ENV creates a command-execution boundary risk.
43. Avoid Strategy Export — Do not export arbitrary strategy text to GITHUB_ENV when a fixed file or validated output can carry the state.
44. Allowlist Strategy IDs — Validate repair strategy identifiers against a closed registry before use.
45. Path Inputs Must Be Fixed — Derive sensitive paths internally from known workspace locations.
46. Path Traversal Defense — Reject path separators, traversal tokens, and control characters in externally supplied path values.
47. Run ID Validation — Validate numeric run IDs before passing them into GitHub CLI/API commands.
48. SHA Validation — Require canonical 40-hex SHA syntax before using a target commit as a security boundary.
49. Fingerprint Validation — Treat failure fingerprints as data identifiers with strict format validation.
50. Argument Boundaries — Prefer argv arrays or fixed flags over shell string concatenation.
51. Shell Is a Parser — Quote discipline alone is not a complete security model; eliminate unnecessary shell interpretation.
52. Command Shape Testing — Test the exact emitted command, not an imagined or simplified version of the workflow.
53. YAML Is Not Shell — Keep YAML interpolation, shell quoting, and JavaScript escaping conceptually separate.
54. Regex Escape Discipline — Do not add escape characters unless required by the actual JavaScript RegExp parser.
55. Literal-Aware Assertions — Prefer literal-aware workflow tests when regex escaping would obscure the intended contract.
56. Workflow Permissions — Give each workflow the narrowest explicit GITHUB_TOKEN permissions required.
57. Read-Only Defaults — Security-sensitive validation jobs should default to read-only repository permissions.
58. Privileged Plane Isolation — Keep privileged repair execution isolated from untrusted content and user-controlled artifacts.
59. Trust Boundary Documentation — Record why a producer, artifact, or value is trusted before using it in a privileged path.
60. Fail-Closed Unknowns — Unknown actor, strategy, state, or source must terminate safely instead of falling through.
61. Actor Allowlist — Repair ownership should map only known durable actors to known execution roles.
62. State Machine Integrity — Repair states must have explicit legal transitions; invalid transitions must fail closed.
63. Ownership Lock — One active repair owner per cycle prevents conflicting mutations and ambiguous evidence.
64. No Concurrent Mutation — Do not mutate execution while exact-SHA verification is in progress.
65. Serialization Is Correctness — A verification race is a control-plane defect even when every individual job is healthy.
66. Watchdog Cancellation Is Evidence — A cancelled watchdog may indicate deduplication, but it is not evidence of GREEN.
67. Queued Is Not Green — A queued check contributes no successful evidence yet.
68. In Progress Is Not Green — Never declare completion from a running check.
69. Cancelled Is Not Pass — Cancellation must be represented as unresolved unless the contract explicitly says otherwise.
70. Skipped Is Not Proof — A skipped required verification cannot certify an exact SHA.
71. Fresh Canonical Evidence — Only evidence produced for the current exact head may close the current cycle.
72. Duplicate Dispatch Defense — Prevent duplicate workflow launches from competing over one execution target.
73. Canonical Branch Model — Repair execution only; preserve main as the production/source-of-truth branch.
74. Promotion Guard — Promotion requires exact-head-SHA equality plus all required GREEN checks.
75. No Partial Promotion — Passing most checks does not authorize merge when one required security gate remains RED.
76. Contract Before Optimization — Preserve existing contracts and tests before improving implementation aesthetics.
77. Single Source of Truth — Registry, resolver, executor, verifier, catalog, and agent must agree on capability identity.
78. Registry Symmetry — Adding a workflow or capability requires corresponding registry and validator updates.
79. Resolver Is Not Executor — A resolver may identify intent, but execution must still validate capability state and parameters.
80. Executor Guardrails — Validate capability executability and parameter schema before running a plan.
81. Planner Authority — AI-generated plans must not bypass the deterministic canonical planner or capability registry.
82. Explicit Confirmation — Destructive or execution actions require an explicit confirmation step where the contract requires it.
83. Memory Is Advisory — Historical memory informs repair strategy; it never overrides current exact-SHA evidence.
84. Anti-Lesson Memory — Rejected strategies must remain visible so the agent does not repeat failed mutations.
85. Fresh Reproduction — Historical success is not a substitute for reproducing the current failure.
86. Causal Fingerprint — Store a stable failure fingerprint so recurring root causes can be correlated across runs.
87. Root Cause Over Symptom — Record trigger, propagation, violated invariant, causal source, and prevention rule.
88. Hypothesis Falsification — A proposed RCA should include a way to disprove it before mutation.
89. Minimal Reproduction — Prefer a focused regression reproducer over a broad speculative change.
90. Blast Radius — Assess how a repair affects contracts, workflows, security, and neighboring capabilities before mutation.
91. Targeted Regression — Add or run a test that fails before the repair and passes after it.
92. Recurrence Test — Verify the repaired path does not immediately recreate the same RED.
93. Prevention Proof — A repair is stronger when it blocks the original causal path, not just the visible symptom.
94. Documentation Is Evidence Aid — Record RCA and prevention rules where agents will consume them, but do not treat docs alone as proof.
95. Teaching Must Be Structured — Lessons should state the rule, why it matters, and the verification condition.
96. Keep Memory Bounded — Preserve useful history without allowing repair memory to become unbounded operational debt.
97. Do Not Poll Blindly — Track workflow state through canonical run/check data instead of repeated guesses.
98. Inspect Before Editing — Read the current file at the current exact SHA immediately before mutation.
99. Recheck After Race — If another bot moves execution, stop using the old blob SHA and reread the new head.
100. Preserve Concurrent Work — Never overwrite a changed file with stale content after a GitHub 409 conflict.
101. Conflict Is a Signal — A Git conflict during automated repair is evidence of concurrent mutation, not permission to force-write.
102. One Mutation at a Time — Avoid stacking multiple speculative fixes before the first one is verified.
103. Security Then Build — Resolve authoritative security REDs before spending mutation budget on downstream build symptoms.
104. Browser Environment RCA — Distinguish browser sandbox/network/runtime failures from application defects using logs before changing product code.
105. Firefox EPERM Lesson — Sandbox or remote-settings failures indicate environment instability when the application assertion never executes.
106. Do Not Mask Browser Failures — Never add product workarounds solely to hide a reproducible browser infrastructure crash.
107. Exact Source Location — Security and lint repairs require the precise source file and sink location.
108. No False Closure — A green targeted test does not close the cycle if the canonical required gate is still unresolved.
109. Certification Freshness — Certification must reference the same current exact SHA and current required-check set.
110. GREEN Definition — GREEN means current exact SHA, required checks complete, security clear, certification valid, and promotion proof consistent.
