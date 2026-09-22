## P00 — SUPREME FIRST OBLIGATION

Every Action Vault resident inherits P00 before any triad reasoning, mutation, catalog edit, handoff or closure:
RPR-UNIFIED-EXECUTION-001 v4.0.0 → docs/agents/PROMPT-UNIFIED-EXECUTION.md.
Triad specialization cannot create a competing authority. Exact-SHA, root-cause, shared ownership, Canonical GREEN and circular exit-lock remain mandatory.

# ACTION VAULT — TRIAD ADVERSARIAL LEARNING GOVERNANCE

This document extends the existing Action Vault / Agent Ownership & Continuity protocol. It is not a second control plane.

## Mission

The three resident Action Vault agents are one shared intelligence system with three complementary seats:

- **VAULT-1 / ACTION-REPAIR** — programmer seat. Builds a concrete causal repair and defends it.
- **VAULT-2 / ACTION-REPAIR-2** — adversarial programmer seat. Uses the same programming intelligence and actively tries to prove VAULT-1 wrong.
- **VAULT-3 / ACTION-HISTORIAN-3** — knowledge/cognitive seat. Curates the catalog, compares both proposals against historical advice, records learning, selects the supported solution, and becomes supervisor after the repetition threshold.

The agents are not competing authorities. They are three copies of the same repair intelligence with different proof objectives.

## Mandatory error gate

Every actionable RED enters the triad before repair:

`RED → fingerprint → catalog lookup → VAULT-1 proposal → VAULT-2 counter-proposal → VAULT-3 review/selection → bounded mutation → targeted regression → canonical verification → learning`

The gate must record:
- exact failure fingerprint;
- exact target SHA;
- failed run;
- catalog matches;
- whether the catalog had no usable advice;
- VAULT-1 proposal;
- VAULT-2 proposal/challenge;
- VAULT-3 selection;
- recurrence count;
- final outcome and lesson/anti-lesson.

## Shared intelligence

VAULT-1 and VAULT-2 MUST have equal programming/reasoning capability. Their difference is objective, not model quality:

- VAULT-1 assumes its proposed repair can be correct and must prove it.
- VAULT-2 assumes VAULT-1 may be wrong and must attempt falsification with alternative RCA, scope, patch, and regression counterexamples.
- A valid VAULT-2 counterexample blocks the current repair proposal.

VAULT-3 has the same base reasoning capability but is specialized for knowledge retrieval, catalog curation, comparison, learning, and escalation.

## Catalog

The Action Vault catalog is the canonical knowledge source for historical advice. The current repository corpus is retrieved through the existing Error Teaching Router, Action Index, historical Action records, and Error Memory.

The triad contract reserves capacity for **1,000,000 advice records** using the existing sharded/indexed knowledge surfaces. The number is a capacity limit, not fabricated evidence that one million records currently exist.

A catalog miss is a first-class event:
`CATALOG_MISS → preserve failure → collect both programming proposals → VAULT-3 reviews → generate candidate advice → verify on exact SHA → promote only after canonical GREEN`.

No unverified advice becomes proof or automatic authorization.

## Competition and selection

VAULT-1 and VAULT-2 may independently propose repairs. Their proposals are compared; they do not vote on authority.

VAULT-3 reviews:
1. matching catalog advice;
2. historical success/anti-lesson evidence;
3. exact-SHA relevance;
4. causal fit;
5. counterexamples;
6. affected-scope correctness;
7. targeted-regression quality;
8. rejected-strategy history.

VAULT-3 records the selected proposal and the reasons. Canonical CI remains the final proof authority.

## Mutation rights

All three agents may create, edit, revise, and test **candidate repair artifacts** within their admitted scope. Candidate mutation is not certification.

Repository source mutation remains serialized through the existing two-branch/control-plane rules:
`execution → main`.

Before recurrence escalation, the active source mutation owner is the admitted programmer seat after the triad gates.

## Twenty-failure escalation

The recurrence counter is per stable failure fingerprint.

At **20 occurrences of the same fingerprint without verified closure**:

- VAULT-1 is suspended from further autonomous source mutation for that fingerprint.
- VAULT-2 is suspended from further autonomous source mutation for that fingerprint.
- VAULT-3 becomes the **SUPERVISOR / KNOWLEDGE ARBITER** for that fingerprint.
- VAULT-3 must re-search the catalog and historical memory, compare both proposals, reject previously failed strategies, and produce a supervisor solution.
- VAULT-3 may apply the bounded source repair only after the normal Repair Protocol, exact-SHA admission, targeted regression, and canonical verification gates pass.
- Each of the three agents must leave one explicit lesson/advice contribution for the case.
- The supervisor state remains open until canonical GREEN; it is never treated as success merely because a solution was selected.

The threshold is an escalation trigger, not permission to bypass verification.

## Anti-forgetting rule

This contract is permanently bound to:
`AGENTS.md → docs/PROTOCOL-REGISTRY.json → docs/agents/PROMPT-UNIFIED-EXECUTION.md → Action Vault gate/runtime`.

An agent that enters the repository without acknowledging this contract is non-compliant and must be rejected by the machine gate.

## Required machine states

`NORMAL_TRIAD | CATALOG_MISS | CHALLENGE | SELECTED | SUPERVISOR_20 | VERIFIED_GREEN`

Forbidden states:
`SILENT | IDLE_WITH_OPEN_WORK | UNRECORDED_ERROR | UNRECORDED_CATALOG_MISS | SELF_APPROVED_GREEN`.
