# FLIXO Release Policy

## 1. Production source

`main` is the only production branch. Older branches must be rebuilt or safely rebased onto current `main` before their changes can be considered for promotion.

## 2. Verification levels

### Developer gate: `npm run check`

`check` is the deterministic repository/build gate. It covers the engineering baseline, router registry, localization, SEO, full localization validation, production build, and performance-budget validation defined by the repository scripts.

Use targeted checks while editing as needed:

```bash
npm run typecheck
npm run lint
```

### Release gate: `npm run verify`

`verify` is the canonical release-oriented code gate. It includes the repository check and the production dependency audit.

### Browser evidence

```bash
npm run test:e2e
```

**Matrix First** in `.github/workflows/full-matrix-parallel.yml` is the sole automatic browser matrix authority. It produces one signed `_flixo_matrix_plan.json`, executes the planned browser/shard units, and exposes one aggregate certificate: **Matrix First Certification**.

The signed matrix plan is the only execution expectation source. Diagnostics may inspect or reproduce failures, but they do not create a second certification truth.

## 3. Evidence-first promotion

A release candidate requires fresh evidence for the **exact commit SHA** being promoted.

Minimum code evidence:

1. `npm run verify` passes.
2. Relevant browser E2E passes.
3. Localization/SEO checks pass when those surfaces changed.
4. Production dependency audit passes.
5. Matrix First Certification passes when browser promotion evidence is required.

A successful local run is useful development evidence, not release certification. A stale CI run is not evidence for a new SHA.

Matrix evidence must bind all of the following to the same signed plan and exact SHA:

- browser and shard assignment;
- planned and observed suites;
- planned and observed Playwright test IDs;
- planned and observed test counts;
- native Playwright status counts;
- runner and Playwright environment fingerprint.

A unit is not successful when it merely returns a zero process exit code. Native evidence must show zero failed, skipped, unexpected, and flaky tests, and exact parity with the signed plan.

## 4. External deployment classification

Provider-side deployment limits are not rewritten as code results.

Use these classifications:

- `CODE_FAILURE` — a reproducible application/repository gate fails.
- `EXTERNAL_DEPLOYMENT_FAILURE` — the code gates are valid but a provider fails to deploy or report status because of quota, rate limit, outage, or provider configuration.
- `CODE_VALID_DEPLOYMENT_UNVERIFIED` — required code evidence is green while deployment evidence is unavailable or externally blocked.

An external deployment failure must remain visible and must never be converted into a fabricated application GREEN or misclassified as a repository build failure.

## 5. Pull request hygiene

- `main` is never the working branch.
- One coherent engineering problem per PR.
- Do not mix dependency upgrades with unrelated refactors.
- Close only PRs that are obsolete, experimental, explicitly "do not merge", superseded, or duplicates after evidence-based triage.
- Rebuild valuable historical work on current `main` instead of merging stale history wholesale.
- Keep dependency experiments isolated until package, lockfile, type, build, audit, and browser effects are proven.

## 6. i18n contract

The runtime path is lazy-first. `src/lib/i18n/loader.ts` owns dictionary loading and Promise caching. Production entry points must not statically import every locale dictionary.

When i18n changes are active, acceptance requires:

- only the requested locale is loaded for route-level runtime access;
- the initial bundle does not contain every locale dictionary;
- fallback behavior remains deterministic;
- localized routing and SEO remain valid for the configured locales.

## 7. Rollback

Every consolidation PR records:

- Before SHA
- After SHA
- Changed files
- Expected behavior
- Validation evidence
- Rollback method

The default rollback is a `git revert` of the merge commit. Manual repair should not replace a clean, auditable rollback unless there is a documented emergency reason.

## 8. Promotion rule

No release is called **GREEN**, **CERTIFIED**, or **production-ready** without current CI evidence for the exact commit. Diagnostics explain failures and preserve evidence; they do not create a second release truth.
