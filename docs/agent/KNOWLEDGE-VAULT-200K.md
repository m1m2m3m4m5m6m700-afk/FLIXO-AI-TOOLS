# FLIXO Repair Agent Action Vault — 1,000,000 Advisory Entries

**Protocol:** `FLIXO-ACTION-VAULT-1M-v2`  
**Knowledge Steward:** `agent3`  
**Read/learn:** all registered agents  
**Mutation:** `agent3` only

## Purpose

Provide the **Repair Agent** with a bounded, provenance-first capacity for up to **1,000,000 normalized lessons/advice records** without turning the Action Vault into an execution authority.

This is a **capacity and governance implementation**, not a claim that 1,000,000 entries have been fabricated or already populated.

## Canonical position

```text
Existing Repair-Agent Knowledge Fabric
        ↓
Advice normalization + SHA-256 fingerprint
        ↓
Deduplication / conflict detection
        ↓
100 deterministic shards × 10,000 maximum records
        ↓
Evidence-aware retrieval
        ↓
Advisory context only
        ↓
Existing Registry → Resolver → Executor → Verifier → Exact-SHA gates
```

The Action Vault is knowledge-owned by `agent3`. It does **not** create a second registry, executor, mutation path, certification path, or prompt authority.

## Record contract

Each advice record carries:

- stable ID and deterministic SHA-256 fingerprint;
- lesson kind: `LESSON`, `ANTI_LESSON`, `RULE`, `HEURISTIC`, or `PLAYBOOK_HINT`;
- scope and root cause;
- action plus applicability and contraindications;
- one or more evidence entries;
- confidence and quality;
- lifecycle status;
- immutable declaration: `executionAuthority = ADVISORY_ONLY`;
- creation/update timestamps.

Evidence can reference an exact target SHA. Historical evidence never certifies a newer SHA.

## Scale model

The vault accepts at most 1,000,000 unique entries.

It is partitioned into **100 deterministic shards**, each bounded at 10,000 entries. Shard assignment is derived from the first eight hexadecimal characters of the advice fingerprint, so the same advice deterministically lands in the same shard.

The system never needs to deserialize all 1,000,000 entries to perform the policy checks that belong to a single shard.

## Quality gates

### Ingestion

1. Validate the schema.
2. Recompute the fingerprint.
3. Reject fingerprint mismatch.
4. Deduplicate by fingerprint.
5. Detect conflicting actions for the same scope/root-cause/kind.
6. Enforce the global 1,000,000 capacity.

### Retrieval

- Current records only.
- Existing Knowledge Fabric confidence/provenance policies remain authoritative.
- Retrieval should be bounded; the canonical candidate ceiling is 128 before downstream selection.
- Advice remains context. It does not grant mutation permission.

### Playbook candidacy

A lesson may become a **PLAYBOOK_CANDIDATE** only after repeated evidence shows:

- at least two distinct failure fingerprints;
- confidence ≥ 0.90;
- quality ≥ 0.80;
- aggregate success rate ≥ 0.80;
- at least one exact-SHA evidence item;
- no reverted evidence.

This status is still advisory. The existing repair-control-plane and verification gates retain execution authority.

## Memory hygiene

Do not manufacture records to reach the number 1,000,000.

Populate the vault from real sources:

```text
verified repair outcomes
→ lessons / anti-lessons
→ normalized advice
→ dedupe
→ evidence retention
→ conflict quarantine
→ retrieval
```

Rejected, reverted, stale, or superseded material must remain traceable rather than silently becoming a positive lesson.

## Safety invariant

**Knowledge can recommend; it cannot authorize.**

Any future adapter that consumes this vault must preserve:

```text
Advice ≠ Permission
Memory ≠ Certification
Historical SHA ≠ Current SHA
Similarity ≠ Proof
One success ≠ General rule
```

## Verification

Focused coverage is implemented in:

`scripts/test-agent-knowledge-vault.mjs`

Canonical implementation:
`scripts/ci/action-vault/repair-agent-advice-vault.ts`

The existing cognitive-agent test suite should import the same contract test so the vault cannot silently drift away from the canonical agent test lane.


## Agent roles

During official repair work:

- **Agent 1** and **Agent 2** are independent competing repair agents. Both have read/learn access and may use vault advice as advisory context. Neither may mutate the Action Vault.
- **Agent 3** is the non-programmer knowledge steward. Agent 3 extracts lessons from verified evidence, normalizes and deduplicates advice, organizes shards, resolves knowledge conflicts, maintains retrieval metadata compatible with the existing search system, and may update/revoke/reclassify vault records.
- Agent 3 does **not** gain source-code mutation, repair execution, merge, or certification authority from this role.

The canonical access contract is implemented in:
`scripts/ci/action-vault/repair-agent-advice-vault.ts`

Allowed Agent 3 Action Vault mutations are limited to:
`UPSERT_ADVICE`, `REVOKE_ADVICE`, `RECLASSIFY_ADVICE`, `MERGE_DUPLICATES`, `RESOLVE_CONFLICT`, `REBALANCE_SHARD_METADATA`, `UPDATE_RETRIEVAL_METADATA`.

Unknown operation, execution operation, gate mutation, or certification operation fails closed.
