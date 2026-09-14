# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## 0. Current state

```text
BRANCH                 = main
ACTUAL MAIN SHA        = 311c3edeb19b81486653816ebd861598aece9381
LAST PROVEN CI SHA     = 13da1202f44c6d314120d260ef65acf2fc69a7e9
LAST PROVEN CI         = 34783338419
LAST PROVEN RESULT     = SUCCESS
CURRENT CODE NOTE      = ADMIN-002 repository proof remains closed on 13da1202…; ADMIN-003 canonical centers read-model coverage is corrected; mandatory task gateway `المهام.md` is enforced by AGENTS.md and validate-agent-protocol; CD production identity RCA is repaired in `.github/workflows/cd.yml` at 156660655… but requires fresh CI/CD verification
CURRENT MAP COMMIT     = this file's resulting commit; documentation only
```

`main` is authoritative. The current code SHA above is not certified until required CI and task-specific evidence are fresh and exact.

## 1. Operating contract

- `ACTIVE` is the only execution-authorized status.
- `LOCKED` means dependency-gated, not forgotten.
- `CANDIDATE ≠ ACTIVE`.
- Completion requires Exact-SHA proof.
- No speculative implementation when provenance, owner, or invariant is unproven.
- Do not create duplicate validators, registries, truth stores, owners, or test engines.
- Never mark `CLOSED / STABLE` from branch-only, stale, partial, inferred, or bypassed evidence.
- **External deployment-provider failure is non-blocking for repository execution.** A Vercel quota, rate-limit, provider outage, or similar infrastructure error must not stop independent code, test, documentation, analysis, or task execution.
- **Provider failure remains a certification blocker only where the task's closure contract explicitly requires live deployment evidence.** It must not be converted into application failure, application GREEN, or a fabricated deployment proof.
- When a provider blocker affects one task, continue all independent work whose prerequisites are satisfied and preserve the blocked task's exact proof status.
- `المهام.md` owns the open execution queue; `PROJECTS.md` owns project state and closed history. The two must remain consistent.

## 2. Task retirement / deletion protocol

Remove a task from the open queue only when:

`MERGED TO MAIN ∧ EXACT MAIN SHA PROVEN ∧ REQUIRED CI/CERTIFICATION PASS ∧ INVARIANT PROVEN ∧ NO DEPENDENT REPAIR ∧ CLOSED HISTORY RECORDED ∧ NEXT TASK UPDATED`

Removal means removal from the active queue, not deletion of engineering memory. RCA, invariant, proof, closure SHA, CI run, and evidence remain in `Closed History`.

The same deletion contract is defined in `المهام.md`; deletion from that file is forbidden until every condition is proven.

A green branch/PR, local pass, code existence, queued job, historical run, or provider bypass never retires a task.

## 3. Current priority queue

| ID | Project | Status | Current truth | Next deterministic action |
|---|---|---|---|---|
| ARCH-001 | Shared Build Boundary Contract | CLOSED / VERIFIED | Exact-SHA proof on `b089bd0…`; existing `BUILD-001` boundary validator passed in full CI certification `34771149429` | Preserve invariant; no new gate |
| AGENT-001 | Persistent Agent Project Gateway | CLOSED / VERIFIED | Gateway/marker protections remained valid on exact SHA `b089bd0…`; full CI certification `34771149429` passed | Preserve single gateway owner; no duplicate validator |
| ADMIN-001 | Admin Control Plane Phase 0/1 | CLOSED / VERIFIED | Existing fail-closed server-boundary contract remains verified on exact SHA `b089bd0…`; full CI certification `34771149429` passed | Preserve canonical server boundary; no duplicate tests |
| **ADMIN-002** | Real persistence + evidence ledger | **CLOSED / VERIFIED** | Repository closure contract satisfied on `13da1202…`: canonical adapter present; real production write/read-back already proven; hardened adapter assertions pass; full CI certification `34783338419` passed; no open ADMIN-002 RCA | Preserve persistence invariant; carry live deployment proof to ADMIN-008 |
| **ADMIN-003** | Admin Truth / Command / Security / Contract / Operations / Incident Centers | **ACTIVE** | Canonical read-only centers adapter is implemented; module posture is aligned; existing Admin boundary regression covers center authorization/read-only behavior with corrected capability fixtures; current main `311c3ede…` has no fresh certification yet | Run affected canonical CI on current main; continue ADMIN-003 only from fresh exact-SHA evidence |
| ADMIN-004 | Admin controlled execution + rollback | LOCKED | Depends on ADMIN-003 | Activate after authorization/policy/evidence/audit/rollback proof |
| ADMIN-005 | Admin Change / Approval / Incident consolidation | LOCKED | Not started | Activate after ADMIN-004 |
| ADMIN-006 | Admin Truth Graph | LOCKED | Not started | Activate after real provenance graph |
| ADMIN-007 | Controlled AI Assistant | LOCKED | Not started | Activate after deterministic authorization/evidence/execution stability |
| ADMIN-008 | Admin production certification | LOCKED | Final Admin certification not complete | Certify one exact candidate SHA, including live deployed-SHA evidence when provider availability permits |
| BUILD-002 | Residual lazy chunk → entry dependency candidates | CANDIDATE | Historical observation only; no new defect proven | Fresh artifact graph analysis before code changes |
| I18N-001 | MutationObserver ownership reanalysis | CANDIDATE | No current regression proven | Trace runtime ownership/lifecycle before repair |
| TEST-001 | Playwright surface ownership cleanup | CANDIDATE | Direct imports remain in config/fixtures/helpers by design | Inventory ownership; remove only unauthorized execution surfaces |
| DEBT-001 | Technical-debt audit candidates | CANDIDATE | Inventory-backed only | Review only fresh-failure/zero-value candidates |

The authoritative open-task list is `المهام.md` and must match the open items above.

## 4. ARCH-001 — Shared Build Boundary Contract

### Historical root cause

`APP / ROUTE REGISTRY → dynamic lazy tool → shared leaf → main / entry chunk`

This created the proven Firefox G4 dynamic-import failure that triggered the shared chunk repair.

### Invariant

```text
APP / BOOTSTRAP
  ↓
LAZY TOOL BOUNDARY
  ↓
SHARED LEAF
  ↓
PURE CONTRACT / UTILITY
```

Forbidden: Shared → App/Router/Route Registry/Global runtime/unrelated Tool Runtime; Lazy Tool → App entry chunk.

### Enforcement

`scripts/ci/validate-build-chunk-boundaries.mjs` is owned by existing `BUILD-001`; no second CI gate.

## 5. ADMIN-001..008 — Admin Control Plane

Primary authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`.

Required path:

`Browser Admin UI → Server/Admin API Boundary → Identity + HTTP-only Session → Capability Authorization → Policy → Domain/Data Adapters → Existing persistence → Evidence → Audit → Controlled execution/rollback`

Hard exclusions: legacy Admin restoration, localStorage authentication, second database stack without proof, fake metrics, client-only security, unrestricted AI execution, speculative microservices, and duplicate page-by-page suites.

### Admin execution acceleration rule

For the Admin sequence, repository closure and live deployment certification are separate proof lanes:

`REPOSITORY PROOF → NEXT ADMIN TASK`

`LIVE DEPLOYMENT PROOF → ADMIN-008 FINAL CERTIFICATION`

An external Vercel blocker MUST NOT hold ADMIN-002, ADMIN-003, ADMIN-004, ADMIN-005, ADMIN-006, or ADMIN-007 when their repository prerequisites and exact-SHA evidence can be proven independently. This does not weaken any fail-closed assertion or permit GREEN without the required evidence for the specific task.

No new CI engine, duplicate validator, bypass, skipped assertion, or weakened regression is permitted to accelerate the sequence.

## 6. ADMIN-002 — Persistence provenance decision

Provider provenance has been established operationally:

- Canonical Supabase project: `zrpsmgdrtwzrhkjwwujo`.
- Provider state: `ACTIVE_HEALTHY`.
- Existing tables discovered: `public.flix_events`, `public.flix_admin_sessions`.
- Vercel Production server bindings were added by the owner; secret values are not stored in the repository.
- Repository contains one server-side REST/PostgREST persistence adapter and an Admin overview reachability probe.
- No new database, ORM, migration, parallel store, or client-side secret exposure was introduced.
- A real production write/read-back proof exists in `public.flix_events` for the repository lineage, and the deterministic adapter test preserves the full evidence payload through write/read-back.

### Closure record

`ADMIN-002 = CLOSED / VERIFIED`

Closure basis on exact `main` SHA `13da1202f44c6d314120d260ef65acf2fc69a7e9`:

`CANONICAL ADAPTER PRESENT ∧ REAL WRITE/READ-BACK PROVEN ∧ TARGETED ADAPTER REGRESSION PASS ∧ REQUIRED CI PASS ∧ EXACT MAIN SHA EVIDENCE ∧ NO OPEN ADMIN-002 RCA`

Canonical CI run: `34783338419`.

The CI run completed successfully for Static + Build, all required Browser FAST/DEEP shards, Certification, and CI/CD Trust. The immutable build and certification artifacts are preserved for this exact SHA.

The Vercel deployment attempt for this SHA was blocked by the external provider daily deployment quota (`api-deployments-free-per-day`). The CD workflow still produced and uploaded fail-closed deployment evidence. This does not reopen or block the ADMIN-002 repository closure; live deployed-SHA proof remains owned by ADMIN-008.

## 7. CD / deployment evidence repair

Repair rule:

`DEPLOY SUCCESS/FAIL → ALWAYS WRITE EVIDENCE → UPLOAD EVIDENCE → FAIL-CLOSED ON IDENTITY MISMATCH`

### RCA-CD-PROD-IDENTITY-001

The previous CD proof incorrectly gated the canonical production checks behind the deployment-specific URL probe:

```text
deployment URL probe FAIL
→ canonical production probe NOT EXECUTED
→ identity job FAIL
```

Run `34791437240` on SHA `6a93798e232b43ba539ba1dfbe7fa1dcfedb560c` proved the deployment itself succeeded and was aliased to `https://flixoai.vercel.app`, while the deployment-specific SHA probe returned empty and caused `DEPLOYMENT_IDENTITY_MISMATCH`.

The causal fix is to treat deployment-specific probing as diagnostic evidence and always execute the authoritative canonical production HTML/SHA checks independently. The release invariant remains:

`PASS ⇔ canonical SHA == promotion SHA ∧ canonical HTML == PASS`

The fix is committed on `main` at:

`156660655b01d2924161815c1e85acdfe120a04d`

Verification status: `PENDING FRESH CI/CD RUN`.

## 8. Historical repair memory

- Shared lazy-chunk topology → ARCH-001.
- I18n observer storms / multiple writers → historically repaired; I18N-001 remains CANDIDATE.
- Route/document locale ownership drift → repaired; preserve one owner.
- H1/SEO name drift → repaired; preserve canonical registry ownership.
- Duplicate CI execution → consolidated; do not reintroduce.
- False-green matrix → repaired; complete exact-SHA graph required.
- Playwright evidence serialization → repaired; preserve object-level evidence.
- Admin route closure conflict → repaired; do not weaken closure validator.
- Agent marker drift → repaired by `e19c494f…`; do not weaken validator.
- Vercel duplicate deployment path → repaired by disabling `main` Git auto-deployment while retaining canonical artifact promotion in `.github/workflows/cd.yml`.
- ADMIN-002 persistence proof → hardened by asserting exact write payload, server-to-Supabase auth boundary, operational fields, and metadata preservation in the canonical adapter test.
- CD production identity → deployment URL/evidence ordering repaired; remaining live proof requires fresh execution of the independent canonical proof path.
- ADMIN-003 centers read model → consolidated into `api/admin/centers.ts`; existing boundary regression covers read-only center authorization and now uses separate capability fixtures so each tested center is exercised under its required authorization.
- Agent task gateway → `المهام.md` is the open execution queue; `AGENTS.md` requires it before action; `validate-agent-protocol.mjs` enforces its presence and required gateway markers.

## 9. Closed History

```text
ARCH-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | BUILD-001 shared build boundary | Static+Build + Certification PASS | CLOSED
AGENT-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | Persistent project gateway / marker protection | Static+Build + Certification PASS | CLOSED
ADMIN-001 | 2026-09-13 | 2026-09-13 | 34771149429 | Fail-closed Admin server boundary | Full CI certification PASS | CLOSED
ADMIN-002 | 2026-09-13 | 13da1202f44c6d314120d260ef65acf2fc69a7e9 | 34783338419 | Real persistence + evidence ledger | Full CI certification PASS; production write/read-back proven; Vercel deployment provider blocked only | CLOSED
```

## 10. Session handoff

```text
LAST SESSION:
  task         = ADMIN-003
  status       = ACTIVE
  entrySha     = 13da1202f44c6d314120d260ef65acf2fc69a7e9
  exitSha      = 311c3edeb19b81486653816ebd861598aece9381
  closureTask  = ADMIN-002
  closureSha   = 13da1202f44c6d314120d260ef65acf2fc69a7e9
  ciRun        = 34783338419
  blocker      = fresh CI evidence for the current ADMIN-003 main SHA is missing; CD production identity repair also needs fresh CD verification
  nextAction   = run affected canonical CI/CD on current main and continue only from fresh exact-SHA evidence
```

## 11. Agent start protocol

```text
READ PROJECTS.md
→ READ المهام.md
→ READ AGENTS.md
→ RESOLVE ACTUAL main SHA
→ IDENTIFY ACTIVE TASK
→ INSPECT CONTRACT / OWNER / RCA
→ EXECUTE MINIMAL PROVEN ACTION
→ TEST IMMEDIATELY
→ VERIFY EXACT SHA
→ UPDATE PROJECTS.md
→ RETIRE ONLY AFTER MAIN PROOF
```

## 12. Evidence rule

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No `GREEN` claim outside these conditions.
