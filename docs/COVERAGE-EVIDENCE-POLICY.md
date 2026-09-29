# FLIXO Coverage Evidence Policy

## Canonical evidence

Release coverage evidence is the exact-SHA `apps/agent-editor/coverage/lcov.info` artifact plus `exact-sha.txt`. The workflow verifies:
- the checkout SHA equals the PR head SHA;
- the lcov file exists and is non-empty;
- source-file, line-found, and line-hit records exist;
- the evidence artifact records the exact SHA and lcov SHA-256.

## External Codecov integration

Codecov is not a certification authority or a required release gate. The repository's previous Codecov upload attempt issued a valid OIDC token but Codecov returned `Repository not found`. Repository activation/visibility in Codecov is outside the repository control plane available to this execution agent.

The repository therefore does not treat Codecov availability as coverage success or failure. The canonical coverage gate is the internal exact-SHA lcov artifact described above. Re-enabling an external coverage mirror requires an owner-authorized Codecov repository activation/configuration and a fresh verification run on the exact candidate SHA.

## Fail-closed rule

Missing, malformed, stale, or SHA-mismatched internal coverage evidence is a failure.
