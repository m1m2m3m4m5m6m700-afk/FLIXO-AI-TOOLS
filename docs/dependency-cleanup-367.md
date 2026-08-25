# Dependency cleanup #367

## Scope
- Identify the package chain introducing deprecated `tsconfck` and `@esbuild-kit/*` packages.
- Avoid `npm audit fix --force`.
- Preserve runtime dependencies and lockfile determinism.
- Record the four moderate audit findings before remediation.

## Current CI evidence
`npm ci` currently reports:
- `tsconfck@3.1.6` deprecated / unmaintained
- `@esbuild-kit/core-utils@3.3.2` merged into `tsx`
- `@esbuild-kit/esm-loader@2.6.5` merged into `tsx`
- 4 moderate severity vulnerabilities

## First safe action
The root `package.json` should be reviewed for direct tooling dependencies whose upgrades can remove the deprecated transitive chain. Changes must be validated by TypeScript, lint, build, contracts, and production audit.
