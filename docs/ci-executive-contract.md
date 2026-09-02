# FLIXO CI — Executive Contract

This branch contains the additive 18-path executive verification layer.

The existing canonical CI workflow is preserved. Executive path results are captured under `artifacts/ci-executive/<job-id>/` and aggregated into `error-report.json`.

## Exhaustive execution

Each executive path invokes `scripts/ci/execute-executive-job.mjs`. Composite commands separated by `&&` are executed as independent subcommands. A failed subcommand is recorded and the runner continues to the remaining subcommands.

The runner writes:

- `artifacts/ci-executive/<job>/combined.log`
- `artifacts/ci-executive/<job>/job-errors.json`
- `artifacts/ci-executive/<job>/<job>-errors.json`
- `artifacts/ci-executive/<job>/result.json`
- `artifacts/ci-executive/<job>/<job>-result.json`

The runner itself exits successfully after recording the test outcome. The aggregate release verdict is owned by the Aggregator, which reads every reported result and every `*-errors.json` payload and generates `error-report.json`.

## Error extraction

`scripts/extract-errors.mjs` recognizes TypeScript, ESLint, runtime, JavaScript exception, test failure, assertion, timeout, fatal, and generic command-exit patterns. Each finding includes the source line, type, severity, raw evidence, and a normalized message.

## Final verdict

`error-report.json` is `GREEN` only when all 18 executive jobs report `PASS` and none are missing. Any failed job or missing result yields `RED` while preserving the collected evidence.

## Matrix fail-fast note

The executive workflow uses 18 independent non-matrix jobs. GitHub Actions `strategy.fail-fast` is therefore not a controlling mechanism for these jobs; continuity is enforced inside the common runner and by the aggregator's `always()` dependency behavior. This prevents a failed test command from stopping sibling paths while preserving a truthful final verdict.
