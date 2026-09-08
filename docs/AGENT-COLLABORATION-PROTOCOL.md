# 🔐 FLIXO Multi-Agent Collaboration Protocol v1

## 1. Purpose

This protocol is the shared coordination contract for every autonomous agent working on FLIXO-AI-TOOLS. It prevents cross-agent confusion, stale-state edits, duplicate ownership, evidence contamination, and conflicting repairs.

The protocol applies to coding, debugging, testing, CI, recovery, auditing, and documentation agents.

## 2. Entry Gate

`AGENTS.md` is the mandatory entry title.

Before any repository action, every agent MUST:

1. Read `AGENTS.md`.
2. Read this protocol.
3. Read `docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`.
4. Read `scripts/ci/test-plan.json`.
5. Read `scripts/ci/assertion-registry.json`.
6. Resolve the current `main` exact SHA.
7. Inspect current workflow state before changing execution logic.

A tool may read only enough surrounding source to establish context; the mandatory contract files above are non-optional.

## 3. Agent Login

Before changing repository state, the agent MUST create a session record using:

`diagnostics/agents/sessions/<sessionId>.json`

The session ID MUST be unique for the active operation.

Minimum schema:

```json
{
  "schemaVersion": 1,
  "sessionId": "unique-session-id",
  "agentId": "stable-agent-name",
  "role": "analysis|implementation|verification|release",
  "entrySha": "exact-sha-read-at-entry",
  "baseSha": "sha-used-for-changes",
  "startedAt": "ISO-8601",
  "scope": ["paths-or-contracts-owned"],
  "currentRca": "RCA-ID-or-null",
  "readFiles": ["required-contract-files"],
  "status": "RUNNING"
}
```

Required lifecycle states are:

`RUNNING → VERIFIED → HANDED_OFF` or `RUNNING → BLOCKED`

A session MUST NOT be silently reused across unrelated work.

## 4. Ownership and Locking

An active agent owns an explicit scope:

`RCA + paths + contracts + execution surface`.

Rules:

- One active owner per RCA.
- One active owner per mutable file scope unless a handoff explicitly transfers ownership.
- An agent MUST NOT overwrite another agent's work based on an old SHA.
- If `main` moves, the agent MUST re-read the new exact SHA before continuing.
- Parallel agents MUST communicate through session/handoff records, not assumptions.

## 5. Action Ledger

The session ledger records meaningful actions in order:

`READ → PLAN → LOCK → CHANGE → VERIFY → HANDOFF`

Each meaningful change SHOULD identify:

`timestamp + action + scope + beforeSha + afterSha + evidence`.

The ledger MUST never claim execution that did not occur.

## 6. Handoff Contract

A completed session MUST provide a handoff containing:

```text
sessionId
agentId
entrySha
exitSha
RCA status
changed files
commands actually executed
evidence/artifacts
findings
open risks
next owner / next action
```

A handoff is invalid when it omits the exact SHA or evidence location.

## 7. Exact-SHA and Stale-State Protection

Every agent MUST treat the current repository SHA as authoritative.

Before editing:

`CURRENT_MAIN_SHA == BASE_SHA`

unless the agent has explicitly refreshed its state.

Historical CI, stale checkpoints, and stale artifacts MUST NOT be used as current proof.

## 8. Evidence Rules

Primary execution evidence MUST remain attributable to one run and one exact SHA.

Agents MUST NOT:

- convert diagnostic evidence into primary evidence;
- reuse another run's evidence;
- overwrite evidence without preserving lineage;
- declare PASS from a summary that is not backed by execution records;
- suppress malformed evidence.

## 9. Failure and Root-Cause Rules

`FAIL`, `CANCELLED`, `BLOCKED`, `NOT_EXECUTED`, `MISSING_EVIDENCE`, and `MALFORMED_EVIDENCE` are not PASS states.

A persistent failure gets an RCA ID.

RCA closure requires:

`mechanism identified → repair → targeted regression → affected contract verification → fresh exact-SHA proof → CLOSED`.

## 10. Multi-Agent Conflict Protocol

When two agents touch the same RCA or scope:

1. Freeze the conflicting change.
2. Compare session IDs and base SHAs.
3. Identify the authoritative/latest state.
4. Keep only one active owner.
5. Record the decision in the handoff.
6. Re-run affected verification on the resulting exact SHA.

No silent conflict resolution.

## 11. Certification Separation

Only the canonical certification engine may issue the repository's final certification result.

Agents may produce evidence and diagnostics but MUST NOT invent an independent GREEN authority.

## 12. Final Agent Logout

Before ending, the agent MUST update its session record with:

`status = VERIFIED` or `BLOCKED`

and include:

`exitSha, changedFiles, commands, evidence, findings, rcaClosed, openRcas, handoff`.

If work is handed to another agent, the record MUST explicitly say what the next agent inherits.

## 13. Enforcement Principle

The repository CI contract MUST validate the presence and structure of this protocol and the entry gate. A repository change that removes or bypasses the protocol MUST fail CI.

This protocol coordinates agents; it does not replace engineering judgment. Exact evidence remains authoritative.
