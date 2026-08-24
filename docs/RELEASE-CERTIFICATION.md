# FLIXO Release Certification

## Purpose

This document defines the final certification path for `main`. It separates deterministic repository gates from browser diagnostics and external deployment-provider status.

## Certification gates

| Gate | Command / workflow | Required |
| --- | --- | --- |
| Type safety | `npm run typecheck` | Yes |
| Lint | `npm run lint` | Yes |
| Engineering baseline | `npm run validate:baseline` | Yes |
| Tool registry | `npm run validate:tool-registry` | Yes |
| Router/registry | `npm run validate:router-registry` | Yes |
| Localization | `npm run validate:i18n`, `npm run validate:home-i18n`, `npm run validate:localization-full` | Yes |
| SEO/indexing | `npm run validate:seo`, `npm run validate:seo-manifest`, `npm run validate:use-case-seo`, `npm run validate:indexing` | Yes |
| CI contract | `npm run validate:ci-contract` | Yes |
| Build | `npm run build` | Yes |
| Performance budget | `npm run validate:performance-budget` | Yes |
| Production dependency audit | `npm run audit:production` | Yes |
| Browser E2E | `npm run test:e2e` | Yes for certification |
| Release evidence | `scripts/test-release-evidence.mjs` | Yes |
| Vercel deployment | Provider status | External / non-code |

## Execution order

`npm run verify` is the canonical deterministic repository gate. Browser E2E is evaluated separately so browser-specific failures can be diagnosed without masking static, security, or contract failures.

## Failure classification

### BLOCKING

A deterministic code, contract, security, build, performance-budget, release-evidence, or required E2E failure blocks certification.

### DIAGNOSTIC

A browser-specific E2E failure is a diagnostic failure until its root cause is identified. It must not be hidden by retries or global timeout increases.

### EXTERNAL_NON_BLOCKING

A provider-side limitation such as a Vercel deployment quota is recorded as an operational blocker, but does not become a fabricated code failure or a false certification success.

## Promotion rule

Do not mark `main` as certified unless all required blocking gates pass on the exact candidate SHA and the final evidence identifies that SHA explicitly.
