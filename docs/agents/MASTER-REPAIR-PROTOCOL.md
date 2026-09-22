# FLIXO Master Repair Protocol v1

## Purpose

The Master Repair layer is a read-only supervisory gate that coordinates the existing FLIXO repair intelligence. It does not create a second mutation authority, a second GREEN authority, or a second branch.

## Canonical sequence

USER/RED SIGNAL
→ exact SHA identity
→ failure evidence
→ read-only scout
→ diagnosis
→ historical memory + anti-lessons
→ teaching packet
→ multi-hypothesis RCA
→ falsification / counterexample search
→ strategy selection
→ Master Repair Gate
→ existing mutation gates
→ bounded mutation
→ targeted regression
→ adversarial post-patch falsification
→ Chair/Control-Plane proof
→ fresh exact-SHA CI
→ Canonical GREEN + Certification
→ learning promotion

## Master Gate invariants

The gate requires current exact-SHA identity, captured failure evidence, scout evidence, diagnosis, proven causal evidence, an In-Repo Repair V2 manifest with at least three alternative hypotheses, a bound repair strategy, at least five falsification checks, and knowledge arbitration that explicitly preserves Canonical CI as proof authority.

A blocked gate does not close the task. It creates a Master escalation/new-evidence requirement and preserves the packet as evidence.

## Authority

The Master Repair layer is READ_ONLY_MASTER_REPAIR_GATE.

It cannot mutate source, write main, create a branch, declare GREEN, certify, override Control Plane state, or replace the existing mutation gate.

## Continuity

An actionable RED remains open until fresh evidence produces a repair path and the existing exact-SHA mutation/verification/Canonical GREEN gates close it.

## Learning

The packet is retained as a lesson/anti-lesson candidate. It is not promoted to trusted knowledge until exact-target verification and Canonical GREEN occur.
