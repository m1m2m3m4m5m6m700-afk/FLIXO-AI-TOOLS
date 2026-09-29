# TestSprite verification for FLIXO

TestSprite is an external browser verification layer for FLIXO. The execution workflow tests the checked-out `execution` SHA through a local TestSprite tunnel.

## Required repository configuration

Set these once in the GitHub repository:

- Secret: `TESTSPRITE_API_KEY`
- Repository variable: `TESTSPRITE_PROJECT_ID`

The API key must include `read:me`, `read:projects`, `read:tests`, `run:tests`, and `run:tunnel` for this local CI path.

## Bootstrap the TestSprite project

Run locally from the repository:

```bash
npm install -g @testsprite/testsprite-cli@0.4.0
testsprite setup
testsprite project create --type frontend --name "FLIXO-AI-TOOLS" --local 3000
```

Start FLIXO:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

Create one frontend test per plan file. Use the CLI-generated plan template to avoid schema drift:

```bash
testsprite test create --plan-template > .testsprite/plan-template.json
testsprite test create --project <project-id> --type frontend --plan-from <plan-file>
```

Run and verify locally:

```bash
testsprite test run --all --project <project-id> --local 3000 --wait --timeout 1200
```

## GitHub Actions

`.github/workflows/testsprite-execution.yml` runs on every push to `execution`.

It:

1. Checks out the exact execution SHA.
2. Installs the FLIXO dependencies.
3. Starts FLIXO on `127.0.0.1:3000`.
4. Installs the pinned TestSprite CLI.
5. Fails closed when either required GitHub value is missing.
6. Runs the existing TestSprite suite against the local checked-out build.
7. Uploads JUnit and summary evidence.

No workflow step creates tests on push and no step uses `continue-on-error`.

## Exact-SHA rule

A TestSprite result is evidence only for the GitHub Actions job that checked out that SHA. It must not be reused as evidence for a later `execution` SHA.

TestSprite is an additional behavioral verification layer; it does not replace FLIXO's typecheck, lint, build, unit, security, browser, or exact-SHA certification gates.
