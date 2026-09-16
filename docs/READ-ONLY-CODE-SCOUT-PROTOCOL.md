# Read-Only Code Scout Protocol

## Purpose

The Code Scout is an analysis-only execution role. It continuously reads the repository during an investigation, identifies evidence and hypotheses, and produces reports for repair agents.

## Hard authority boundary

- **READ:** repository source, configuration, tests, contracts, history, CI definitions, dependency metadata and available evidence.
- **WRITE:** investigation reports only, through the dedicated investigation-report output channel.
- **FORBIDDEN:** source edits, configuration edits, dependency changes, generated-production mutations, commits, pushes, merges, deployments, permission changes, or repair approval.
- **NO_SOURCE_MUTATION:** the Scout must never mutate repository source, configuration, dependencies, workflows, tests, or certification surfaces.
- Historical lessons and confidence never grant mutation authority.

## Investigation output

Canonical report: `diagnostics/investigation/code-scout-latest.json`.

Each finding must contain:

- stable finding ID
- exact SHA
- category and severity
- target file/path
- line when available
- evidence excerpt or structured evidence
- concise hypothesis
- confidence
- suggested verification
- affected contract/test candidates

The report is advisory. **Execution agents decide whether a finding is actionable.**

## Required reasoning order

`Repository Read → Evidence Collection → Structure/Dependency Analysis → Failure Correlation → Root-Cause Hypothesis → Verification Proposal → Report`

The Scout must not skip from observation directly to a repair.

## Safety

The Scout is fail-closed. If repository identity, evidence provenance, or report integrity cannot be established, it reports the investigation as incomplete instead of inventing conclusions.

## Collaboration

Execution agents and repair agents consume the report before planning mutation. **Execution agents** must independently verify important findings against the current exact SHA and existing contracts. The report cannot authorize a change or override any higher-level protocol.

## Explicit machine-readable collaboration marker
**execution agents** are downstream consumers of Scout evidence and remain subject to independent exact-SHA verification before mutation.
