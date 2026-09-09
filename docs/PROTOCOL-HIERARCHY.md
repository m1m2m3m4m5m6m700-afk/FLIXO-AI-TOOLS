# FLIXO Protocol Hierarchy & Anti-Bloat Contract v1

This document is the normative hierarchy for repository execution protocols. It does not create independent duplicate procedures; it defines precedence and the four cross-cutting controls that existing protocols must use.

## Objective

Protocols exist to prevent classes of failure. They MUST remain minimal, non-contradictory, machine-enforceable where practical, and subordinate to the repository's product contracts.

A new protocol MUST NOT be introduced merely to document a preference. It requires a demonstrated recurring failure mode, a named invariant, a clear enforcement boundary, and evidence that existing controls cannot prevent that failure.

## Precedence

When rules appear to conflict, precedence is:

1. Master execution and safety contract.
2. Zero-False-Green and evidence integrity requirements.
3. Root-Cause-First Repair Protocol.
4. Product contract graph: G1, G2, G3, G4 and release gates.
5. Change-Scope Integrity and Dependency-Graph Closure controls.
6. Testing, certification, collaboration, coordination, and recovery procedures.
7. CI performance and operational optimization.

A lower-level rule MUST NOT weaken or override a higher-level invariant. Speed, convenience, retries, sharding, or ownership changes are never valid reasons to reduce required correctness or evidence.

## Change-Scope Integrity

Every non-trivial change MUST declare its affected source files, assertions, coverage, contracts, execution surfaces, and expected non-affected surfaces. The executor MUST verify the declared affected graph and MUST NOT silently expand or shrink scope to evade a failure.

A targeted repair is complete only when its declared scope is verified on the resulting exact SHA and any newly discovered affected surface is either verified or assigned a new RCA/task.

## Dependency-Graph Closure

A passing local regression is necessary but insufficient. Every repair MUST traverse the affected dependency and contract graph from the authoritative source through dependent assertions and execution surfaces.

Closure requires:

`authoritative source → dependent contracts → canonical assertions → execution owners → evidence → certification`

Any broken downstream invariant discovered during closure is a new or extended RCA and keeps the execution state in recovery until resolved.

## Evidence Freshness & Provenance

Primary evidence MUST be bound to one exact commit SHA, one execution run, the applicable contract/version, input identity, environment/runtime identity, and artifact identity where applicable.

Evidence MUST be rejected when it is stale, detached from the tested SHA, malformed, incomplete, or derived only from a diagnostic summary. Handoff reports provide continuity only and never substitute for certification evidence.

## Protocol Conflict Resolution

Overlapping or contradictory protocol requirements MUST be resolved through the precedence chain above. Agents MUST NOT choose the easier interpretation, suppress the conflict, or create an exception locally.

A conflict is itself an execution finding: freeze the affected scope, identify the controlling invariant, record the decision in the session/task evidence, and re-run the affected verification on the resulting exact SHA.

## Protocol Addition Gate

No new standalone protocol is allowed unless all conditions are satisfied:

`recurring failure class proven → existing controls insufficient → invariant named → authoritative enforcement boundary named → regression/enforcement test defined → duplication/conflict analysis passed`

If an existing protocol can absorb the requirement without ambiguity, extend that protocol instead of creating another one.

## Completion Rule

Protocol compliance is not certification. Certification remains fail-closed and requires all product contracts, required tests, evidence, coverage, and root causes to be closed on the same exact SHA.
