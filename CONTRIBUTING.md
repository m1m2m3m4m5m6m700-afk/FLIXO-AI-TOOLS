# Contributing to FLIXO-AI-TOOLS

## Branch policy

The repository uses two operational branches only:

- `main` — production/reference branch. Changes reach it through a pull request after the required certification gates pass.
- `experimental` — the single development and experimentation line. New work is consolidated here; no additional long-lived development branches should be created.

Temporary GitHub refs may exist only for automation and cleanup purposes and must not become alternate development lines.

## Delivery lifecycle

`Implement → Verify → Certify → Freeze → Promote`

```text
experimental
    ↓
Implement
    ↓
Fast → Medium → Functional → Browser Critical → Stability → Full
    ↓
Evidence Integrity
    ↓
Release Decision
    ↓
CERTIFIED
    ↓
Pull Request
    ↓
main
```

## Pull request rules

Every production PR must have a bounded scope, current Evidence, valid Gate Manifests, and a Release Decision appropriate to its scope. Evidence must match the certified commit and run and must not be expired or tampered with.

## Certification rules

An artifact or tool is not production-ready merely because its UI or route exists. For release certification, the required gates must pass and the Release Decision must be `CERTIFIED` for the current commit/run.

Required evidence fields include:

```text
commit
runId
gate
sha256
createdAt
expiresAt
```

## Baselines

Certified tools keep their baseline under:

```text
baselines/<tool>/certification-baseline.json
baselines/<tool>/provenance.json
```

A frozen baseline is immutable. A transient re-run is a re-validation, not a new baseline. A new baseline requires a full re-certification.

## CI and re-runs

Gates should be independently executable where practical. When a gate fails, re-run the failing job rather than successful upstream gates. Final release validation must reject missing, stale, mismatched, expired, or tampered Evidence.

## Security

Do not commit secrets, disable security gates to obtain green CI, or use forceful dependency changes as a blind workaround. External service failures such as deployment quotas must be classified separately from application-code failures.

The normal CI Socket check may be skipped when `SOCKET_SECURITY_API_KEY` is not configured. Release certification is stricter: configure `SOCKET_SECURITY_API_KEY` as a GitHub Actions repository/environment secret so the blocking Socket supply-chain gate can pass.

Never place the Socket credential in source code, workflow literals, committed `.env` files, or client-side configuration.

## Tool lifecycle

```text
placeholder → planned → ready → certified → frozen baseline → public
```

A public tool must have a real runtime and the applicable automated regression/certification coverage.

## Definition of done

A change is complete when its implementation, tests, build/contracts, Evidence, certification decision, documentation, and release scope are all consistent with the repository policy.
