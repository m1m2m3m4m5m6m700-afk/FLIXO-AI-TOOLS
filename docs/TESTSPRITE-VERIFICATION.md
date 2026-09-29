# TestSprite verification for FLIXO

TestSprite is an external browser verification layer for FLIXO. The execution workflow tests the checked-out `execution` SHA through a local TestSprite tunnel.

## Required repository configuration

Set these once in the GitHub repository:

- Secret: `TESTSPRITE_API_KEY`
- Repository variable: `TESTSPRITE_PROJECT_ID`

The API key used for the local frontend path needs the TestSprite scopes required by the CLI, including `run:tunnel` and the permissions needed to read and create tests. Local V3 projects are required for `--local` frontend runs.

## Bootstrap the TestSprite project

Start FLIXO locally:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

Then create one V3 local frontend project:

```bash
npm install -g @testsprite/testsprite-cli@0.4.0
testsprite setup --no-agent
testsprite project create --type frontend --name "FLIXO-AI-TOOLS" --local 3000
```

Store the returned project id as the GitHub repository variable `TESTSPRITE_PROJECT_ID`.

The committed plan templates live under `.testsprite/plans/`. They cover the FLIXO Agent's compound planning, confirmation guard, ambiguity clarification, cancellation, Arabic routing, tool discovery, and memory restoration.

## Create the committed FLIXO suite

The GitHub workflow has a manual `bootstrap_suite` input. Run the `TestSprite Live E2E (execution)` workflow against the current `execution` ref with `bootstrap_suite=true` once after the project variable and API secret are configured.

The bootstrap path:

1. Replaces the plan-template project id with the configured TestSprite project id.
2. Runs `testsprite test lint` locally against every plan.
3. Reads the project's existing frontend tests.
4. Creates only missing cases with `test create-batch`.
5. Runs the complete project suite against FLIXO on the same checked-out SHA.

Subsequent pushes run the existing suite only; they do not create duplicate TestSprite tests.

## Local verification

The canonical TestSprite local flow is:

```bash
testsprite test lint --plan-from-dir .testsprite/plans
testsprite test list --project <project-id> --type frontend --output json
testsprite test run --all --project <project-id> --local 3000 --wait --timeout 1200
```

A successful `--wait` run exits 0. A failing or blocked run exits non-zero. An empty run is also non-zero by default, preventing a false-green gate.

## GitHub Actions

`.github/workflows/testsprite-execution.yml` runs on every push to `execution`.

It:

1. Checks out the exact execution SHA.
2. Installs the FLIXO dependencies.
3. Starts FLIXO on `127.0.0.1:3000`.
4. Installs the pinned TestSprite CLI.
5. Validates the committed TestSprite plans offline.
6. Fails closed when the required TestSprite configuration is missing.
7. Optionally bootstraps only missing committed cases when a maintainer explicitly enables `bootstrap_suite`.
8. Runs the existing TestSprite suite through the local tunnel.
9. Uploads JUnit, summary, bootstrap-plan, and FLIXO startup-log evidence.

No workflow step uses `continue-on-error`, and normal pushes do not mutate the external TestSprite suite.

## FLIXO Agent behavioral coverage

The committed cases verify these user-facing contracts:

- Compound request → deterministic two-step plan.
- Confirmation without an image → blocked execution.
- Ambiguous crop request → targeted clarification instead of guessing.
- Cancellation → prepared plan cleared and no tool execution.
- Arabic compound request → RTL plus equivalent two-step semantics.
- Tool discovery → canonical Background Remover can populate the Agent command.
- Reload → prepared plan restored from conversation memory.

These complement the repository's existing Playwright Agent E2E tests, which exercise actual local file upload, execution, result preview, and download.

## Exact-SHA rule

A TestSprite result is evidence only for the GitHub Actions job that checked out that SHA. It must not be reused as evidence for a later `execution` SHA.

TestSprite is an additional behavioral verification layer; it does not replace FLIXO's typecheck, lint, build, unit, security, browser, or exact-SHA certification gates.
