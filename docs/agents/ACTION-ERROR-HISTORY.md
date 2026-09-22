# FLIXO — Action Error & Repair History

Generated: 2026-09-20
Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`

> هذا الملف يجمع السجل التاريخي الذي يحتفظ به المستودع من GitHub Actions عبر Error Memory/Root-Cause learning، مع سجل الحوادث التاريخي القديم ونتائج الإصلاح الموثقة. ليس تصديرًا حرفيًا لكل Run في واجهة GitHub؛ أداة GitHub المتاحة هنا لا توفر endpoint مُصفحًا لكل تاريخ التشغيل، لذلك تم الاعتماد على السجلات التاريخية التي حفظها المستودع نفسه.



## 0. Earliest documented Action failure

**Earliest failure currently recoverable from the repository's historical records: F-001 — Invalid E2E Artifact Names.**

- Era: **GitHub Actions Run #1324/#1325**
- Surface: Playwright E2E diagnostics upload
- Failure: artifact upload rejected names such as `e2e-diagnostics-shard-2/6`
- Root cause: the Playwright shard value `N/M` was reused as an artifact name; GitHub artifact names cannot contain `/`.
- Repair: decoupled test shard syntax from artifact labels and used `N-of-M` naming.
- Historical status: **Fixed**.
- This is the earliest Action-specific failure explicitly recorded in `docs/ERROR_MEMORY.md`. The repository snapshot does **not** provide enough retained evidence to prove that no earlier GitHub Actions failure ever occurred before this run era, so this file calls it the **earliest documented/recoverable failure**, not an absolute proof of the repository's first-ever failure.

## Chronological failure history

### Era 1 — First documented E2E/CI incidents

1. **F-001 — Invalid E2E artifact names — Run #1324/#1325**
   - Root: invalid artifact naming contract.
   - Result: **fixed**.

2. **F-002 — upload-artifact Node 20 deprecation**
   - Root: workflow still used the older action major.
   - Repair: upgraded to `actions/upload-artifact@v6`.
   - Result: **fixed and subsequently observed successfully finalizing artifacts**.

3. **F-003 — duplicate meta description**
   - Root: legacy `index.html` metadata duplicated route-owned SEO metadata.
   - Repair: removed legacy shell description.
   - Result: **fixed**.

4. **F-004 — E2E SEO text contract drift**
   - Root: assertion followed stale wording instead of the intended SEO contract.
   - Repair: aligned assertion with the stable production contract.
   - Result: **fixed**.

5. **F-005 — E2E result-presentation timeout**
   - Root symptom: test waited on presentation text.
   - Repair attempt: wider processing window + output-oriented verification.
   - Result: **superseded** because the later run exposed a deeper production defect rather than proving the timing change was sufficient.

6. **F-006 — SVG decode failure**
   - Historical run: **#1329, E2E Shard 2**.
   - Root: `createImageBitmap(file)` was not reliable for SVG in Chromium CI.
   - Repair: SVG-safe `HTMLImageElement + object URL` fallback; raster path retained.
   - Result: **code fixed; historical record explicitly says CI revalidation was still required at the time of recording**.

7. **F-007 — router/registry contract false positive**
   - Historical run: **#2028**.
   - Root: validator inferred routes from source text and mishandled non-ready registry entries.
   - Repair: TypeScript AST analysis recognizing `createRoute(...)` and `imageToolRoute(...)`, plus ready/non-ready route separation.
   - Verification: **Run #2035 PASS**, merged as `130f77f6905ddfa88322e1f2ad48cae47c2d4e93`.
   - Result: **fixed and CI-verified**.

### Era 2 — Canonical repair/verification architecture

The repository then accumulated a machine-readable root-cause catalog and historical learning system. Examples explicitly represented in `scripts/ci/root-causes.json` include:

- CI/security baseline import and path-policy defects.
- CI contract lint and evidence-regex defects.
- control-plane registry drift.
- watcher cancellation/evidence/target-selection defects.
- workflow syntax defects.
- router literal mismatch.
- build stylesheet import defect.
- Task Agent governance-marker drift.
- Firefox `networkidle` synchronization instability.
- Auto-Repair expected-SHA propagation failure.
- Auto-Repair stale-base/rebase drift.
- Auto-Repair downstream postflight masking.
- duplicate watcher-run storms.
- historical-learning provenance gaps.

Each catalog entry records its repair targets and the verification command(s) expected to prove the invariant.

### Era 3 — High-frequency repair wave

The current machine Error Memory contains:

- **19 fingerprint cases**
- **47 distinct historical Action run IDs referenced by provenance**
- **2 represented workflows** in those historical provenance records
- **6 root-cause kinds** in those cases.

The dominant recorded fingerprint family in this current extraction is `webkit-render`, followed by `typescript`, `unknown`, `build`, `certification`, and `external-tooling`.

The current Error Memory explicitly distinguishes:
- historical failures,
- proposals,
- engine-level unrepaired attempts,

and does **not** treat any of these automatically as verified repair.

### Era 4 — 2026-09-19 current historical-learning wave

The current repository records many newer exact-SHA incidents, including:

- WebKit/static/build fingerprint families around runs **35419365959 → 35420543755**.
- repeated TypeScript failures across runs **35419232849 → 35420228023**.
- unknown WP0 runner failures around **35417216668** and **35417501209**.
- repeated external-tooling/repair-engine failures from runs **35424089172** through **35427463513**.
- later documented external provider blockers: Vercel deployment rate limiting and GitHub Code Scanning AI model rejection.

These modern records are retained as historical evidence and are subject to exact-SHA requalification; they do not certify the current head.

## Historical repair-result taxonomy

For the complete history, the repair result must be read from the strongest available evidence in this order:

`verified-repair` → exact-SHA canonical CI/verification → `reverted-repair` → `blocked-external` → `unrepaired` / `failed` / `proposed`.

A source-code commit by itself is never recorded here as proof of repair.

## Evidence boundary

The repository preserves two complementary histories:

1. **Incident history** — human-readable F-001..F-007 and later incident records.
2. **Machine history** — Error Memory fingerprints, run IDs, failed SHAs, workflows, outcomes, and root-cause catalog entries.

The machine history currently reaches back farther in Action-run identity than the human-readable incident ledger, but the retained repository data does not provide a complete paginated export of every GitHub Actions run ever executed. Therefore the strongest defensible statement is:

**F-001 / Run #1324/#1325 is the earliest GitHub Actions failure currently documented and recoverable from the repository's retained history.**

## 1. Coverage

- Error Memory schema: 10
- Fingerprint cases: **19**
- Unique historical Action run IDs referenced: **47**
- Workflows represented in those provenance records: **2**
- Root-cause kinds in current Error Memory: **6**
- Outcome counts:
- historical: 27
- proposed: 1
- unrepaired: 20

## 2. Historical Action failures — canonical Error Memory

| # | Fingerprint | Root cause | Action runs | Recorded outcome | Extracted error signal | Failure excerpt |
|---:|---|---|---|---|---|---|
| 1 | `cefe8e431b2be0d946960754d598c026fdb7e760c2b8803922a69344eb2921c0` | webkit-render | 35420543755 | historical / failure / run 35420543755 / SHA 72192ed56d3bf68d8c4737f24b693d19a3e607bf / workflow FLIXO Test System / at 2026-09-19T04:11:01Z | Static + Build Build contracts 2026-09-19T04:10:43.9230749Z dist/assets/job-Bm0bembN.js 10.39 kB │ gzip: 3.71 kB \|\| Static + Build Build contracts 2026-09-19T04:10:43.9231372Z dist/assets/browser-image-BC8QdgK4.js 11.04 kB │ gzip: 4.50 kB \|\| Static + Build Build contracts 2026-09-19T04:10:43.9231990Z dist/assets/pix-c0pDJhwF.js 11.45 kB │ gzip: 4.12 kB \|\| Static + Build Build contracts 2026-09-19T04:10:43.9232613Z dist/assets/vendor-radix-BSin40q1.js 27.63 kB │ gzip: 9.34 kB \|\| Static + Build Build contracts 2026-09-19T04:10:43.9233259Z dist/assets/image-toolkit-BXNLi87H.js | Static + Build Build contracts 2026-09-19T04:10:42.6191918Z ##[group]Run npm run test:build Static + Build Build contracts 2026-09-19T04:10:42.6192269Z ^[[36;1mnpm run test:build^[[0m Static + Build Build contracts 2026-09-19T04:10:42.6229891Z shell: /usr/bin/bash -e {0} Static + Build Build contracts 2026-09-19T04:10:42.6230152Z env: Static + Build Build contracts 2026-09-19T04:10:42.6230356Z HOME: /tmp Static + Build Build contracts 2026-09-19T04:10:42.6230573Z NPM_CONFIG_AUDIT: false Static + Build Build contracts 2026-09-19T04:10:42.6230824Z NPM_CONFIG_FUND: false Static + Build Build contracts 2026-09-19T04:10:42.6231081Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Build contracts 2026-09-19T04:10:42.6231390Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Build contracts 2026-09-19T04:10:42.6231733Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Build contracts 2026-09-19T04:10:42.6232071Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Build Build cont… |
| 2 | `34c22b220ea6fdb6103bedefc90d64d4ce1d8e9e1f296b5dc06fae609284c3e7` | webkit-render | 35420538695 | historical / failure / run 35420538695 / SHA 43caa916d0ab515c60633371e0aaf52fbc6dc95e / workflow FLIXO Test System / at 2026-09-19T04:11:12Z | Static + Build Static contracts 2026-09-19T04:10:41.5317953Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 \|\| Static + Build Static contracts 2026-09-19T04:10:41.9573811Z CI contract failed: PR cancellation is missing from .github/workflows/ci.yml | Static + Build Static contracts 2026-09-19T04:10:40.9128724Z ##[group]Run npm run test:static Static + Build Static contracts 2026-09-19T04:10:40.9129357Z ^[[36;1mnpm run test:static^[[0m Static + Build Static contracts 2026-09-19T04:10:40.9150459Z shell: /usr/bin/bash -e {0} Static + Build Static contracts 2026-09-19T04:10:40.9150911Z env: Static + Build Static contracts 2026-09-19T04:10:40.9151195Z HOME: /tmp Static + Build Static contracts 2026-09-19T04:10:40.9151573Z NPM_CONFIG_AUDIT: false Static + Build Static contracts 2026-09-19T04:10:40.9151924Z NPM_CONFIG_FUND: false Static + Build Static contracts 2026-09-19T04:10:40.9152230Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Static contracts 2026-09-19T04:10:40.9152634Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Static contracts 2026-09-19T04:10:40.9153096Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Static contracts 2026-09-19T04:10:40.9153547Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Bui… |
| 3 | `73040a161c5db072490c2f29d923520a227756b656c27a23502ff5707fa57c9e` | webkit-render | 35420361618 | historical / failure / run 35420361618 / SHA bbbb12c8cfdc598cccc497dee0f4931820c453c9 / workflow FLIXO Test System / at 2026-09-19T04:09:36Z | Static + Build Static contracts 2026-09-19T04:08:11.6240837Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | Static + Build Static contracts 2026-09-19T04:08:10.6359206Z ##[group]Run npm run test:static Static + Build Static contracts 2026-09-19T04:08:10.6359530Z ^[[36;1mnpm run test:static^[[0m Static + Build Static contracts 2026-09-19T04:08:10.6396256Z shell: /usr/bin/bash -e {0} Static + Build Static contracts 2026-09-19T04:08:10.6396525Z env: Static + Build Static contracts 2026-09-19T04:08:10.6396721Z HOME: /tmp Static + Build Static contracts 2026-09-19T04:08:10.6396932Z NPM_CONFIG_AUDIT: false Static + Build Static contracts 2026-09-19T04:08:10.6397168Z NPM_CONFIG_FUND: false Static + Build Static contracts 2026-09-19T04:08:10.6397412Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Static contracts 2026-09-19T04:08:10.6397721Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Static contracts 2026-09-19T04:08:10.6398055Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Static contracts 2026-09-19T04:08:10.6398361Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Bui… |
| 4 | `ac42590a393a7959ef4a5eeafb4404be388d65a4fdf8bdf30f6b8bd8d1c8e32b` | webkit-render | 35420250490 | historical / failure / run 35420250490 / SHA 58643f73135db2be3dbe5df4b95f1c0b8a87008c / workflow FLIXO Test System / at 2026-09-19T04:04:27Z | Static + Build Static contracts 2026-09-19T04:03:45.4067362Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | Static + Build Static contracts 2026-09-19T04:03:44.8699262Z ##[group]Run npm run test:static Static + Build Static contracts 2026-09-19T04:03:44.8699658Z ^[[36;1mnpm run test:static^[[0m Static + Build Static contracts 2026-09-19T04:03:44.8738130Z shell: /usr/bin/bash -e {0} Static + Build Static contracts 2026-09-19T04:03:44.8738488Z env: Static + Build Static contracts 2026-09-19T04:03:44.8738761Z HOME: /tmp Static + Build Static contracts 2026-09-19T04:03:44.8739060Z NPM_CONFIG_AUDIT: false Static + Build Static contracts 2026-09-19T04:03:44.8739403Z NPM_CONFIG_FUND: false Static + Build Static contracts 2026-09-19T04:03:44.8739752Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Static contracts 2026-09-19T04:03:44.8740187Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Static contracts 2026-09-19T04:03:44.8740648Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Static contracts 2026-09-19T04:03:44.8741097Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Bui… |
| 5 | `532797ab0996e58cc954922f4d6dd589d7da1be2c19d93d8035903cded49b2b3` | webkit-render | 35420028452 | historical / failure / run 35420028452 / SHA 85992c2599c19d7789ed9500e525afb5e84be5ff / workflow FLIXO Test System / at 2026-09-19T03:59:24Z | Static + Build Static contracts 2026-09-19T03:58:40.5025690Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | Static + Build Static contracts 2026-09-19T03:58:39.9167662Z ##[group]Run npm run test:static Static + Build Static contracts 2026-09-19T03:58:39.9167935Z ^[[36;1mnpm run test:static^[[0m Static + Build Static contracts 2026-09-19T03:58:39.9200269Z shell: /usr/bin/bash -e {0} Static + Build Static contracts 2026-09-19T03:58:39.9200498Z env: Static + Build Static contracts 2026-09-19T03:58:39.9200674Z HOME: /tmp Static + Build Static contracts 2026-09-19T03:58:39.9200856Z NPM_CONFIG_AUDIT: false Static + Build Static contracts 2026-09-19T03:58:39.9201057Z NPM_CONFIG_FUND: false Static + Build Static contracts 2026-09-19T03:58:39.9201252Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Static contracts 2026-09-19T03:58:39.9201511Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Static contracts 2026-09-19T03:58:39.9201787Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Static contracts 2026-09-19T03:58:39.9202043Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Bui… |
| 6 | `b45d3ec6d6885e6c85aa0e862e2c6899644c8416992f750a2f146a512b528314` | webkit-render | 35419365959 | historical / failure / run 35419365959 / SHA 1a7508400db2401d8bf07dcb9e7531cd5c3085cf / workflow FLIXO Test System / at 2026-09-19T03:45:00Z | Static + Build Static contracts 2026-09-19T03:44:18.5272761Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | Static + Build Static contracts 2026-09-19T03:44:17.8698009Z ##[group]Run npm run test:static Static + Build Static contracts 2026-09-19T03:44:17.8698331Z ^[[36;1mnpm run test:static^[[0m Static + Build Static contracts 2026-09-19T03:44:17.8738111Z shell: /usr/bin/bash -e {0} Static + Build Static contracts 2026-09-19T03:44:17.8738386Z env: Static + Build Static contracts 2026-09-19T03:44:17.8738586Z HOME: /tmp Static + Build Static contracts 2026-09-19T03:44:17.8738796Z NPM_CONFIG_AUDIT: false Static + Build Static contracts 2026-09-19T03:44:17.8739030Z NPM_CONFIG_FUND: false Static + Build Static contracts 2026-09-19T03:44:17.8739271Z NPM_CONFIG_UPDATE_NOTIFIER: false Static + Build Static contracts 2026-09-19T03:44:17.8739572Z VITE_SITE_URL: https://flixoai.vercel.app Static + Build Static contracts 2026-09-19T03:44:17.8739895Z VITE_RUNTIME_ORIGIN: http://127.0.0.1:3000 Static + Build Static contracts 2026-09-19T03:44:17.8740200Z VITE_TEST_ORIGIN: http://127.0.0.1:3000 Static + Bui… |
| 7 | `ba3bbbf8fb1d4a7b5bae359001af478400fbd02aeed2fc96052b9b84c0fb2424` | build | 35420543823, 35420311094 | historical / failure / run 35420543823 / SHA 72192ed56d3bf68d8c4737f24b693d19a3e607bf / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:10:59Z; historical / failure / run 35420311094 / SHA 46bda7d04763c3151a6755b31c5bbe7c4f1ace7e / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:05:36Z; proposed / proposal-only / run 35420543823 / SHA 72192ed56d3bf68d8c4737f24b693d19a3e607bf / at 2026-09-19T04:12:04.022Z | WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ##[group]Run npm run test:build WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ^[[36;1mnpm run test:build^[[0m WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> env: WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> EXPECTED_SHA: <SHA> WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ##[endg… | WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ##[group]Run npm run test:build WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ^[[36;1mnpm run test:build^[[0m WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> env: WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> EXPECTED_SHA: <SHA> WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> ##[endgroup] WP0 Trust Baseline — Single Verification Path 12 — Canonical build verification <TIME> WP0 Tru… |
| 8 | `6daeedbea89e727478dfd0eac0ac64fb336e6140611f8d6ba48755123b89f04c` | certification | 35420361617 | historical / failure / run 35420361617 / SHA bbbb12c8cfdc598cccc497dee0f4931820c453c9 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:06:04Z | WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.7022469Z const fail = (message) => { throw new Error(`CI/CD TRUST FAILURE: ${message}`); }; \|\| WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.7023690Z Error: CI/CD TRUST FAILURE: canonical certification-surface validator failed: \|\| WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.7025405Z "status": "FAIL", \|\| WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.7032501Z "certification": "single fail-closed certify job" \|\| WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.7043732Z at fail (file:///home/runner/work/FLIXO-AI-TOOLS/FLIX… | WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5494074Z ##[group]Run npm run verify:ci-cd-trust WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5494543Z ^[[36;1mnpm run verify:ci-cd-trust^[[0m WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5540968Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5541212Z env: WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5541445Z EXPECTED_SHA: bbbb12c8cfdc598cccc497dee0f4931820c453c9 WP0 Trust Baseline — Single Verification Path 07 — Canonical CI/CD trust and exact-SHA gate 2026-09-19T04:06:00.5541770Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 07 — Canonical CI… |
| 9 | `b6d4e5d4153f58631c67b426690afcfa2dbdd2ecae30c011051d3cea3eba9c64` | unknown | 35420259059 | historical / failure / run 35420259059 / SHA e48de4a9bc12d27be7dd09b66ccf69ca6e0cb507 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:03:32Z | WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3532222Z ##[error]Process completed with exit code 1. | WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3356725Z ##[group]Run set -euo pipefail WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3358483Z ^[[36;1mset -euo pipefail^[[0m WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3359796Z ^[[36;1mtest "pull_request" = "pull_request"^[[0m WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3361604Z ^[[36;1mtest "chore/cleanup-redundant-foundation-docs" = "execution"^[[0m WP0 Trust Baseline — Single Verification Path 02 — Verify exact execution checkout identity and bind agent to execution 2026-09-19T04:03:29.3363359Z ^[[36;1mtest "main" = "main"^[[0m WP0 Trust Baseline — Single Verifi… |
| 10 | `3effd3fe4242dd41eccde82cf598ff9586c26426116b49f39ab629935dd30189` | webkit-render | 35420250500 | historical / failure / run 35420250500 / SHA 58643f73135db2be3dbe5df4b95f1c0b8a87008c / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:04:04Z | WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.6814766Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0328665Z ##[group]Run npm run test:static WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0328990Z ^[[36;1mnpm run test:static^[[0m WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0350128Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0350416Z env: WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0350682Z EXPECTED_SHA: 58643f73135db2be3dbe5df4b95f1c0b8a87008c WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0351047Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T04:03:41.0351355Z SITE_URL: https://flixoai.vercel.… |
| 11 | `0393de4416e5b0f0ece88db992f6602c08cba073e0fec44b9287551dce100716` | typescript | 35420228023, 35420182421, 35420162011, 35420160379, 35420141734, 35420138785, 35420131890, 35420124386, 35420028403 | historical / failure / run 35420228023 / SHA da1195d0b843f16e5184ed0d4778ddf0a604c572 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:03:10Z; historical / failure / run 35420182421 / SHA 468d6e135514caf62b487b7097445566ebe5fa7a / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:02:40Z; historical / failure / run 35420162011 / SHA 03617714355f28c653b63362262cbfeb6a366ae9 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:02:10Z; historical / failure / run 35420160379 / SHA 4ede4abb5b20d0b89cec873fa72ac6c35005dc88 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:02:09Z; historical / failure / run 35420141734 / SHA 7a8716a3392de9a6a35b78fde31e018299b5ae57 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:01:44Z; historical / failure / run 35420138785 / SHA 5473495c9ebea4fc91a4dab75261188118eaf2eb / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:01:43Z; historical / failure / run 35420131890 / SHA ac847c09c0325be4ab06dfa7f3d02f613f9875fb / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:01:10Z; historical / failure / run 35420124386 / SHA fa51f3f8a4c2ea724c375cc1be2748c7466484ea / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T04:01:05Z; historical / failure / run 35420028403 / SHA 85992c2599c19d7789ed9500e525afb5e84be5ff / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:58:54Z | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:50.7691612Z ##[error]src/routes/admin-control-plane.tsx(112,57): error TS2367: This comparison appears to be unintentional because the types 'AdminModuleStatus' and '"Bمقفل"' have no overlap. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:50.8172613Z ##[error]Process completed with exit code 2. | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8674534Z ##[group]Run npm run typecheck WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8674865Z ^[[36;1mnpm run typecheck^[[0m WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8710121Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8710380Z env: WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8710641Z EXPECTED_SHA: 85992c2599c19d7789ed9500e525afb5e84be5ff WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8711005Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8711328Z SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:58:43.8711618Z ##[endgroup] WP0 Trust Baseline — Single Verificat… |
| 12 | `0c34cb9acfc5243b230b21d270a4d8d86e4a3e977b264ce2110374e270690407` | webkit-render | 35419365984 | historical / failure / run 35419365984 / SHA 1a7508400db2401d8bf07dcb9e7531cd5c3085cf / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:44:22Z | WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.9004101Z G3 universal artifact integrity matrix: executed=20 passed=20 failed=0 skipped=0 | WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0630399Z ##[group]Run npm run test:static WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0630760Z ^[[36;1mnpm run test:static^[[0m WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0668012Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0668321Z env: WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0668603Z EXPECTED_SHA: 1a7508400db2401d8bf07dcb9e7531cd5c3085cf WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0669004Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 11 — Canonical static verification 2026-09-19T03:43:58.0669357Z SITE_URL: https://flixoai.vercel.… |
| 13 | `4f932e3819b76dc0a24095bca7c5ba05650e43b4ec49922a074bc7927606184a` | typescript | 35419331549 | historical / failure / run 35419331549 / SHA f80ae9e8e04694ee8a0ab60b8ca2447cb2bd3ee0 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:43:16Z | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:14.1806432Z ##[error]src/tools/image-compressor/index.tsx(7,37): error TS2305: Module '"./file-safety"' has no exported member 'CompressionFormat'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:14.2259784Z ##[error]Process completed with exit code 2. | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.3980370Z ##[group]Run npm run typecheck WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.3980957Z ^[[36;1mnpm run typecheck^[[0m WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4034895Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4035329Z env: WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4035773Z EXPECTED_SHA: f80ae9e8e04694ee8a0ab60b8ca2447cb2bd3ee0 WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4036429Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4037013Z SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:43:07.4037506Z ##[endgroup] WP0 Trust Baseline — Single Verificat… |
| 14 | `46899dec92850fd77d23d9f4806abc953d4d071feed50b2d25a9bf199b55aaa3` | typescript | 35419308228 | historical / failure / run 35419308228 / SHA c43e065b818ba5797b1bdb19da1990196e9f11f9 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:42:55Z | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:52.2792675Z ##[error]src/config/canonical-tool-definition.ts(40,225): error TS2322: Type 'Promise<typeof import("/home/runner/work/FLIXO-AI-TOOLS/FLIXO-AI-TOOLS/src/tools/image-cropper/index")>' is not assignable to type 'Promise<{ default: ComponentType; }>'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:52.2801938Z ##[error]src/tools/image-compressor/index.tsx(7,37): error TS2305: Module '"./file-safety"' has no exported member 'CompressionFormat'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:52.3005857Z ##[error]Process completed with exit code 2. | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7962284Z ##[group]Run npm run typecheck WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7962656Z ^[[36;1mnpm run typecheck^[[0m WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7984776Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7985091Z env: WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7985360Z EXPECTED_SHA: c43e065b818ba5797b1bdb19da1990196e9f11f9 WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7985759Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7986073Z SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:42:47.7986338Z ##[endgroup] WP0 Trust Baseline — Single Verificat… |
| 15 | `8ea67f8fc4ae327e3b3654ac5ee762c4a3d446d21cb0610aa63ac2eccecea8f5` | typescript | 35419262333 | historical / failure / run 35419262333 / SHA c285ad6a2ed12e98be2827e1c39113da913c690f / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:41:52Z | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:50.1005983Z ##[error]src/config/canonical-tool-definition.ts(40,225): error TS2322: Type 'Promise<typeof import("/home/runner/work/FLIXO-AI-TOOLS/FLIXO-AI-TOOLS/src/tools/image-cropper/index")>' is not assignable to type 'Promise<{ default: ComponentType; }>'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:50.1018302Z ##[error]src/tools/image-compressor/index.tsx(7,32): error TS2305: Module '"./file-safety"' has no exported member 'MAX_FILES'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:50.1020137Z ##[error]src/tools/image-compressor/index.tsx(7,43): error TS2305: Module '"./file-safety"' has no exported member 'MAX_INPUT_SIZE'. \|\| WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:50.1022310Z ##[error]src/tools/i… | WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3953421Z ##[group]Run npm run typecheck WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3953759Z ^[[36;1mnpm run typecheck^[[0m WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3989568Z shell: /usr/bin/bash -e {0} WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3989817Z env: WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3990076Z EXPECTED_SHA: c285ad6a2ed12e98be2827e1c39113da913c690f WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3990445Z VITE_SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3990765Z SITE_URL: https://flixoai.vercel.app WP0 Trust Baseline — Single Verification Path 10 — Typecheck 2026-09-19T03:41:43.3991031Z ##[endgroup] WP0 Trust Baseline — Single Verificat… |
| 16 | `0268fbbaae1969e762f85d8e8dad911180350c3d60634c32ec63aed21ad69714` | typescript | 35419232849 | historical / failure / run 35419232849 / SHA e5fa936c7a0c6b9354d15c01bd3eaf5044952117 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:41:04Z | WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.6285341Z ##[error]Process completed with exit code 1. | WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4246509Z ##[group]Run set -euo pipefail WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4246842Z ^[[36;1mset -euo pipefail^[[0m WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4247082Z ^[[36;1mnpm run test:agent-execution-gate^[[0m WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4247366Z ^[[36;1mnpm run test:agent-execution-control^[[0m WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4247655Z ^[[36;1mnpm run test:agent-capability^[[0m WP0 Trust Baseline — Single Verification Path 05 — Task state, confirmation and cancellation contract 2026-09-19T03:41:01.4279359Z shell: /usr… |
| 17 | `8ba70fb57a722ff30b0dafec92a9aacf6ba6f286ead1d2bb477f1b9840b07dc5` | unknown | 35417501209 | historical / failure / run 35417501209 / SHA 49c3699555af41464e15745f45708bb20a7cc0fe / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T03:05:37Z | WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.5473083Z ##[error]Unable to resolve action `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0`, the provided ref `043fb46d1a93c77aae656e7c1c64a875d1fc6a0` is the shortened version of a commit SHA, which is not supported. Please use the full commit SHA `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` instead. | WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2571446Z Current runner version: '2.337.0' WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2607271Z ##[group]Runner Image Provisioner WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2608860Z Hosted Compute Agent WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2610098Z Version: 20260828.587 WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2611306Z Commit: abac92662cab4cc7352de4f9f9d2e2419aad9c29 WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2612653Z Build Date: 2026-08-28T16:44:25Z WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2614036Z Worker ID: {de50f01b-1fde-42d7-b241-692018cd57e2} WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T03:05:35.2615488Z Azure Region: eastus2 WP0 Trust Baseline — Single Ve… |
| 18 | `fbe5a42fb8a5af9e6d55dad1cd9d0a654ffb6f351e160f7921f78d3818bdec18` | unknown | 35417216668 | historical / failure / run 35417216668 / SHA af708277c53f268dc9011d91dd9d5a1743809a56 / workflow FLIXO WP0 Trust Baseline / at 2026-09-19T02:58:40Z | WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:38.4650130Z ##[group]Setting up auth \|\| WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:38.4656009Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand \|\| WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:38.4692840Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' \|\| :" \|\| WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:38.5182004Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader \|\| WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:38.5185475Z [command]/usr/bin/git submodule foreach --recursive sh -c… | WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5745649Z Current runner version: '2.337.0' WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5780377Z ##[group]Runner Image Provisioner WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5781713Z Hosted Compute Agent WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5782779Z Version: 20260828.587 WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5783832Z Commit: abac92662cab4cc7352de4f9f9d2e2419aad9c29 WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5785280Z Build Date: 2026-08-28T16:44:25Z WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5786464Z Worker ID: {6b6fa58e-cdd4-4a57-8ae5-f6157ddcb602} WP0 Trust Baseline — Single Verification Path UNKNOWN STEP 2026-09-19T02:58:37.5787690Z Azure Region: eastus WP0 Trust Baseline — Single Ver… |
| 19 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | external-tooling | 35424089172, 35424112877, 35424272134, 35424134112, 35424403952, 35424444043, 35424403916, 35425814734, 35425840484, 35426019583, 35426688324, 35426694228, 35425840483, 35426112796, 35426630274, 35427245542, 35427245533, 35427288342, 35427458433, 35427463513 | unrepaired / engine-error / run 35424089172 / SHA f0682dd9e95324dc1b9d37d43b4be5b3cb89f5c4 / at 2026-09-19T05:33:52.567Z; unrepaired / engine-error / run 35424112877 / SHA 190d0c3bb36a62c3095171486a4093d77d2c7570 / at 2026-09-19T05:34:30.449Z; unrepaired / engine-error / run 35424272134 / SHA 411bb45408321bb7ae281b228f14fef2cd890f65 / at 2026-09-19T05:34:46.432Z; unrepaired / engine-error / run 35424134112 / SHA 45c1072c7802e9031b6e968bef487f581848e100 / at 2026-09-19T05:35:15.854Z; unrepaired / engine-error / run 35424403952 / SHA 7587630fa6efbbe32b8369979cde44081359ae8b / at 2026-09-19T05:41:58.301Z; unrepaired / engine-error / run 35424444043 / SHA 8c9f3e3ab4010d26447f54871133894159180090 / at 2026-09-19T05:45:58.100Z; unrepaired / engine-error / run 35424403916 / SHA 7587630fa6efbbe32b8369979cde44081359ae8b / at 2026-09-19T06:02:52.768Z; unrepaired / engine-error / run 35425814734 / SHA 389abeecdf313497d2db203f182a338ae76145c6 / at 2026-09-19T06:12:28.001Z; unrepaired / engine-error / run 35425840484 / SHA a9621dcc6b7c45e2b589123af86ee5bb1de4b46d / at 2026-09-19T06:13:08.068Z; unrepaired / engine-error / run 35426019583 / SHA 330ec6ca51f789fe9aeeca089dc994dd4608d427 / at 2026-09-19T06:14:38.867Z; unrepaired / engine-error / run 35426688324 / SHA 1b6abc79e580073d57c98630840ad91ceda6462b / at 2026-09-19T06:30:39.353Z; unrepaired / engine-error / run 35426694228 / SHA cf0453aad659f801fa5a2de0aaaaab57db0aad35 / at 2026-09-19T06:31:01.108Z; unrepaired / engine-error / run 35425840483 / SHA a9621dcc6b7c45e2b589123af86ee5bb1de4b46d / at 2026-09-19T06:31:40.118Z; unrepaired / engine-error / run 35426112796 / SHA c471b15907cf55b4aaa42412aa9e57c48817ec05 / at 2026-09-19T06:32:18.211Z; unrepaired / engine-error / run 35426630274 / SHA 5105b3afa20fa51d66d4fe366e8b23821ce48732 / at 2026-09-19T06:32:56.552Z; unrepaired / engine-error / run 35427245542 / SHA b1fe925182ecbcaaea65e53daff51110ac9faa5e / at 2026-09-19T06:41:04.264Z; unrepaired / engine-error / run 35427245533 / SHA b1fe925182ecbcaaea65e53daff51110ac9faa5e / at 2026-09-19T06:41:38.891Z; unrepaired / engine-error / run 35427288342 / SHA 9a6da1ebb0af6ae1493987239aa753a1f6b45ff0 / at 2026-09-19T06:42:00.697Z; unrepaired / engine-error / run 35427458433 / SHA 9ea9022107e65737417848612c7c83389d63480a / at 2026-09-19T06:47:04.661Z; unrepaired / engine-error / run 35427463513 / SHA 3c2a44fff4e812dd54904703d147cf5d76a0370c / at 2026-09-19T06:48:35.260Z |  |  |

### Interpretation of recorded outcomes

- `historical / failure` = the Action failure was imported as historical evidence; the memory entry itself does **not** prove that a repair subsequently reached verified-repair.
- `unrepaired / engine-error` = the repair engine itself failed to produce a repair result; this is not evidence that the source defect was fixed.
- `proposed / proposal-only` = a repair proposal existed, but it is not treated as a successful repair.

## 3. Legacy Error Memory — F-001..F-007

The repository's earlier incident ledger contains seven explicit incidents with historical repair results:

## F-001 — Invalid E2E Artifact Names

**Area:** GitHub Actions / Playwright diagnostics  
**First observed:** Run #1324/#1325 era  
**Symptom:** E2E shard failed while uploading diagnostics with names such as `e2e-diagnostics-shard-2/6`.  
**Root cause:** `/` is not allowed in GitHub artifact names. The same shard value was used both as the Playwright `--shard` value and as the artifact name.  
**Evidence:** GitHub annotation explicitly reported `Forward slash /` as invalid.  
**Fix:** Decoupled the test shard expression from the artifact label and used names such as `e2e-diagnostics-shard-2-of-6`.  
**Prevention:** Never use `N/M` directly in an artifact name. Convert it to `N-of-M` or use a numeric matrix index.

## F-002 — upload-artifact Node 20 Deprecation

**Area:** CI infrastructure  
**Symptom:** GitHub warned that `actions/upload-artifact@v4` targeted Node.js 20 and was being forced onto Node.js 24.  
**Root cause:** Workflow still referenced an older action major version.  
**Fix:** Upgraded to `actions/upload-artifact@v6`.  
**Evidence:** Subsequent E2E logs show `actions/upload-artifact@v6` and successful artifact finalization.  
**Prevention:** Pin current maintained major versions for GitHub Actions and review Node-runtime deprecation notices separately from application failures.

## F-003 — Duplicate Meta Description

**Area:** SEO / React-TanStack head management  
**Symptom:** E2E detected more than one `meta[name="description"]`.  
**Root cause:** `index.html` contained a legacy static description (`Flixo foundation`) while the route also supplied the production SEO description.  
**Fix:** Removed the legacy description from the shell so the route is the single source of truth for the tool page metadata.  
**Prevention:** Keep global HTML shell metadata minimal and let localized routes own page-specific SEO tags.

## F-004 — E2E Text Contract Drift

**Area:** Playwright / SEO contract  
**Symptom:** E2E searched for wording that the page no longer used.  
**Root cause:** Test assertion and the actual page SEO contract had diverged.  
**Fix:** Updated the assertion to match the intended production description instead of changing the page merely to satisfy the old assertion.  
**Evidence:** The route defines the description as `Compress JPG, PNG, and WebP images online in your browser...`.  
**Prevention:** Assertions should target stable product contracts and semantic output, not incidental prose.

## F-005 — E2E Timeout on Result Presentation

**Area:** Playwright / image processing  
**Symptom:** The first failing shard timed out after 5 seconds while waiting for `/smaller file size/`.  
**Root cause:** The test used a presentation string as the first synchronization point rather than the actual output artifact.  
**Fix:** Increased the allowed processing window and moved verification toward the real download output.  
**Important:** This incident was only a timing symptom. The following run proved the underlying image path still had a real production defect (F-006), so increasing the timeout was not accepted as the final fix.

## F-006 — SVG Decode Failure in Image Compressor

**Area:** Image engine / Chromium E2E  
**Symptom:** The output link never appeared within the test window. Diagnostics showed: `The source image could not be decoded.`  
**Root cause:** The engine relied on `createImageBitmap(file)` for all supported image types, but SVG decoding was not reliable in the Chromium CI environment. The product advertised SVG input support.  
**Evidence:** Run #1329 E2E Shard 2 failed; the uploaded screenshot showed the user-facing decode error. The engine previously called `createImageBitmap(file)` directly.  
**Fix:** Added an SVG-safe decode fallback using `HTMLImageElement` plus an object URL, while retaining `createImageBitmap()` for raster images and cleaning up the object URL.  
**Status:** Code fix committed as `753dbe71a235d158574f04107ea527cbe3b62280`; CI revalidation is required before declaring fully fixed.  
**Prevention:** Every advertised input format must have a dedicated decode path covered by a real E2E input fixture.

## F-007 — Router / Registry Contract False Positive

**Area:** Routing governance / CI verification  
**Symptom:** `Canonical Verification Gate` failed with routes reported as missing from `TOOLS_REGISTRY`, even though the registry contained the corresponding public tool paths. A later diagnostic run also reported the non-ready `photo-colorizer` route as expected, which was itself incorrect.  
**Root causes:** The initial validator searched route source text and could not understand the project's `imageToolRoute(...)` helper. It also built the expected public route set from every registry path instead of only `isReady: true` tools and then separately enforcing non-ready exclusion.  
**Evidence:** CI Run #2028 failed on the unused `registryPath`; the subsequent Canonical Gate run failed on the source-discovery model and then exposed the `photo-colorizer` expected-set bug. The repository's actual `src/routes/image-tools.tsx` defines public routes through `imageToolRoute(...)`.  
**Fix:** Replaced regex-only route scraping with TypeScript AST analysis that recognizes both `createRoute(...)` and `imageToolRoute(...)`; split ready public routes from non-ready exclusion checks. The resulting PR #203 passed CI Run #2035 and was merged as `130f77f6905ddfa88322e1f2ad48cae47c2d4e93`.  
**Invariant:** `TOOLS_REGISTRY` is the source of truth; only ready tools may contribute expected public routes; non-ready tools must be absent from public routing.  
**Prevention:** Validators must model the real router construction and readiness contract, not infer behavior from incidental source strings.

## 4. Canonical Root-Cause Catalog

Current machine-readable root-cause records: **41**

| Root cause ID | Category | Description | Repair targets | Verification | Prevention |
|---|---|---|---|---|---|
| `RC-DEPENDENCY-001` | DEPENDENCY | Committed dependency graph cannot be installed or resolved. | package.json, package-lock.json | npm ci |  |
| `RC-DEPENDENCY-ZERO-DEBT-001` | DEPENDENCY_ZERO_DEBT | Direct dependency declarations are not aligned with actual source/build/test usage, or the committed lockfile drifts from the declared dependency graph. | package.json, package-lock.json, scripts/report-dependency-usage.mjs | npm run validate:dependency-zero-debt |  |
| `RC-TYPE-001` | TYPE | TypeScript/static contract failure. | src, scripts | npm run typecheck |  |
| `RC-I18N-001` | I18N | Locale or localized UI contract failure. | src/lib/i18n, src/locales | npm run validate:i18n |  |
| `RC-SEO-001` | SEO | SEO/canonical/indexing contract failure. | src, scripts | npm run validate:seo |  |
| `RC-ROUTER-001` | ROUTER | Route resolution or registry parity failure. | src/routes, src/lib | npm run validate:router-registry |  |
| `RC-BUILD-001` | BUILD | Production build or generated artifact failure. | vite.config.ts, src, scripts | npm run build |  |
| `RC-RUNTIME-001` | RUNTIME | Browser runtime, page error, or console execution failure. | src, tests | npm run test:browser |  |
| `RC-NETWORK-001` | NETWORK | Browser request or response failure. | src, playwright.config.ts | npm run test:browser |  |
| `RC-BROWSER-001` | BROWSER | Browser gate failed without a more specific root cause. | src, tests | npm run test:browser |  |
| `RC-CI-EVIDENCE-001` | CI_EVIDENCE | Evidence is stale, incomplete, or not authoritative for the executed gates. | scripts/test.mjs, scripts/ci | npm run test:diagnose |  |
| `RC-CI-CONTRACT-001` | CI_CONTRACT | Workflow and executable certification contract drifted. | .github/workflows, scripts/ci, package.json | npm run validate:ci-contract |  |
| `RC-CI-DEEP-SEMANTIC-IDENTITY-001` | CI_EVIDENCE | DEEP execution evidence used one canonical semanticUnitId while certification ownership lookup reconstructed a different key shape, producing false missing-unit failures despite complete 20-locale x 3-browser evidence. | scripts/ci/record-playwright-execution.mjs, scripts/ci/validate-execution-graph.mjs, scripts/ci/test-execution-graph-semantic-identity.mjs | node scripts/ci/test-execution-graph-semantic-identity.mjs ; node scripts/ci/validate-execution-graph.mjs |  |
| `RC-G4-FIREFOX-NATIVE-DOWNLOAD-001` | BROWSER | Firefox did not emit Playwright's download event for the result-control synthetic anchor click, even though the generated image Blob and result object URL were valid. The cross-browser contract is repaired by exposing the primary Download now control as a native download link while preserving the existing user-facing role and filename contract. | src/tools/image-toolkit/index.tsx, tests/image-upscaler.spec.ts | npx playwright test tests/image-upscaler.spec.ts --project=firefox ; npx playwright test tests/image-upscaler.spec.ts --project=chromium ; npx playwright test tests/image-upscaler.spec.ts --project=webkit |  |
| `RC-IMAGE-CORE-BOUNDARY-001` | RUNTIME_CONTRACT | Image Core document mutators accepted runtime-invalid layer and selection state despite TypeScript types, allowing invalid opacity, transforms, masks, enum values, duplicate identifiers, missing targets, and malformed selection bounds to enter the shared document model. | src/image-core/document.ts, scripts/test-image-core-contract.mjs | npm run test:image-core ; npm run typecheck ; npm run test:static |  |
| `RC-TOOL-CATALOG-SCALING-001` | ARCHITECTURE | Tool management depended on a flat registry with duplicated lookup patterns, making large tool counts increase routing and discovery overhead and encouraging duplicated per-system catalogs. The scalable replacement is a single indexed Tool Catalog with stable identity, canonical route indexes, alias collision checks, readiness indexing, lazy component loading, and typed operational metadata without unsafe inference. | src/config/registry.ts, src/config/tool-platform/types.ts, src/config/tool-platform/catalog.ts, scripts/test-tool-platform-catalog.mjs | npm run test:tool-platform ; npm run validate:tool-registry ; npm run test:static |  |
| `RC-SEED-REDO-GPU-SYNC-001` | BROWSER | Seed's browser contract sampled WebGL canvas pixels after UI actions using fixed wall-clock waits, while React state/history changes trigger a requestAnimationFrame render with no observable completion boundary. Under CI scheduling variance, Chromium could sample a previous framebuffer after redo even though the page had no console, page, or network failure. The repair exposes a monotonic data-render-revision only after the GPU render returns successfully and makes pixel assertions await that c… | src/tools/seed/index.tsx, tests/seed.spec.ts | npx playwright test tests/seed.spec.ts --project=chromium ; npx playwright test tests/seed.spec.ts --project=firefox ; npx playwright test tests/seed.spec.ts --project=webkit |  |
| `RC-UNKNOWN-001` | UNKNOWN | Failure could not be assigned to a known root cause. |  | npm run test:diagnose |  |
| `RC-SECURITY-BASELINE-IMPORT-001` | CI_SECURITY | Repository security baseline referenced the REPAIR_GATE_AUTOMATION control-plane registry without importing the symbol, causing a deterministic ReferenceError before the trust-perimeter scan could run. | scripts/ci/repository-security-baseline.mjs | node scripts/ci/repository-security-baseline.mjs ; npm run verify:ci-cd-trust | Security baseline consumers of control-plane registry symbols must import every referenced registry export; exact-head CI execution is the regression proof. |
| `RC-SECURITY-BASELINE-PATH-POLICY-001` | CI_SECURITY | Repository security baseline compared registry workflow basenames against repository-relative workflow paths and required dynamically generated policy paths to appear as literal strings, causing false security failures after the registry became canonical. | scripts/ci/repository-security-baseline.mjs | node scripts/ci/repository-security-baseline.mjs ; node scripts/ci/test-auto-repair-final.mjs | Normalize control-plane registry workflow names to repository-relative paths before allowlist comparison and accept canonical REPAIR_GATE_AUTOMATION expansion rather than requiring duplicated literals. |
| `RC-CI-CONTRACT-LINT-001` | CI_CONTRACT | The canonical CI contract validator contained an unnecessarily escaped quote inside a regex literal, causing ESLint no-useless-escape to fail the WP0 trust baseline. | scripts/validate-ci-contract.mjs | npm run lint ; npm run validate:ci-contract | Keep regex literals free of unnecessary string-style quote escaping; lint remains a mandatory contract regression. |
| `RC-CONTROL-PLANE-DRIFT-001` | CI_CONTROL_PLANE | Trust-perimeter workflow and path protection rules were duplicated across the registry, repair policy, security baseline, and tests, allowing registry-driven controls to drift from textual assertions. | scripts/ci/control-plane-registry.mjs, scripts/ci/auto-repair-policy.mjs, scripts/ci/repository-security-baseline.mjs, scripts/ci/test-auto-repair-final.mjs | node scripts/ci/repository-security-baseline.mjs ; node scripts/ci/test-auto-repair-final.mjs | Control-plane workflow ownership, write authority, security-critical workflows, history coverage, and trust perimeter paths must be consumed from the canonical registry. |
| `RC-WATCH-CANCELLATION-001` | CI_EVIDENCE | Cancelled workflow runs were treated as generic internal failures without distinguishing valid supersession from an unsuperseded cancellation. | scripts/ci/continuous-error-watch.mjs, scripts/ci/test-continuous-error-watch.mjs | node scripts/ci/test-continuous-error-watch.mjs | Classify cancelled runs using same workflow, exact SHA, branch, successor state, and replacement evidence; superseded cancellations are not repair targets. |
| `RC-WATCH-EVIDENCE-001` | CI_EVIDENCE | CI log retrieval used a permissive fallback that could leave missing or error text in the evidence map and still allow repair target creation. | .github/workflows/daily-flixo-green-gate.yml, scripts/ci/continuous-error-watch.mjs, scripts/ci/test-continuous-error-watch.mjs | node scripts/ci/test-continuous-error-watch.mjs | Evidence retrieval emits an explicit capture marker and missing capture forces FAIL_CLOSED before repair dispatch. |
| `RC-WATCH-TARGET-001` | CI_EVIDENCE | Repair target selection did not enforce all target invariants before producing targetRunId. | scripts/ci/continuous-error-watch.mjs, scripts/ci/test-continuous-error-watch.mjs | node scripts/ci/test-continuous-error-watch.mjs | Require completed failure/timed-out state, exact execution SHA, execution branch, repairable workflow allowlist, no self target, non-superseded state, and evidence before dispatch. |
| `RC-HISTORICAL-LEARNING-001` | CI_LEARNING | Historical learning defaulted to a partial workflow set and did not persist structured workflow/job/SHA occurrence provenance for each fingerprint. | scripts/ci/control-plane-registry.mjs, scripts/ci/learn-from-historical-actions.mjs, .github/workflows/auto-repair.yml | node scripts/ci/learn-from-historical-actions.mjs | Historical coverage is derived from the canonical registry and fingerprints preserve firstSeenAt, lastSeenAt, occurrences, workflow, jobs, SHA, classification, and strategy metadata. |
| `RC-WATCH-WORKFLOW-SYNTAX-001` | CI_CONTRACT | The evidence-capture shell block was temporarily malformed by incorrect indentation inside a YAML run block, causing the workflow to fail before creating a job. | .github/workflows/daily-flixo-green-gate.yml | Daily FLIXO Green Gate exact-SHA run | Treat YAML workflow syntax and shell indentation as first-class regression targets before evaluating runtime gate behavior. |
| `RC-ROUTER-PATH-LITERAL-001` | ROUTER | TanStack Router generated route types reject trailing-slash literal links such as /ar/ when the canonical registered route is /ar; this caused exact-head WP0 typecheck failure. | src/routes/tools-page.tsx | npm run typecheck ; npm run validate:router-registry | Use registered TanStack route literals (/ar) or route templates/params instead of ad-hoc trailing-slash string literals. |
| `RC-CI-CONTRACT-EVIDENCE-REGEX-001` | CI_CONTRACT | The CI contract validator used a cross-line regex that falsely paired a real gh run view --log-failed command with a later intentional \|\| true on gh run list, producing a false RED during canonical static verification. | scripts/validate-ci-contract.mjs | npm run lint ; npm run validate:ci-contract | Evidence-swallow checks must be scoped to the same command line or parsed command block; intentional idempotency fallbacks in unrelated commands must not satisfy the forbidden pattern. |
| `RC-AUTO-REPAIR-PROTOCOL-MARKER-001` | CI_CONTRACT | The auto-repair engine migrated reproduction command ownership to evidence.reproductionSelection.commands, but validate-agent-protocol retained the historical impactedTests marker and failed canonical static verification. | scripts/ci/validate-agent-protocol.mjs | npm run test:static ; npm run validate:agent-protocol | Protocol validators must assert current authoritative execution markers after contract migrations and should not depend on obsolete implementation syntax. |
| `RC-WATCH-TEST-EVIDENCE-FIXTURE-001` | CI_EVIDENCE | Continuous error watch self-test expected RED_INTERNAL for an internal failed workflow while providing no captured log evidence; the production reducer correctly fails closed on missing evidence. | scripts/ci/test-continuous-error-watch.mjs | node scripts/ci/test-continuous-error-watch.mjs | Internal RED fixtures must include explicit EVIDENCE_CAPTURE=AVAILABLE evidence when asserting RED_INTERNAL; missing evidence is always FAIL_CLOSED. |
| `RC-WATCH-RUN-STORM-001` | CI_CONCURRENCY | Daily Green Gate workflow_run triggers accumulated duplicate watcher runs because the watcher used one global non-canceling concurrency lane while historical Test System completions continued arriving. | .github/workflows/daily-flixo-green-gate.yml, scripts/validate-ci-contract.mjs, scripts/ci/test-auto-repair-final.mjs | npm run validate:ci-contract ; node scripts/ci/test-auto-repair-final.mjs | Watcher executions are supersedable by branch; Auto-Repair execution remains isolated and non-canceling. |

| `RC-GREEN-GATE-DISPATCH-STORM-001` | CI_CONCURRENCY | Daily Green Gate dispatched the six required workflows from multiple observer and settlement wakes for the same exact SHA; cancelled runs were treated as absent and triggered another dispatch, creating a self-amplifying same-SHA workflow storm. | .github/workflows/daily-flixo-green-gate.yml, scripts/ci/test-repair-supervision-contract.mjs, scripts/validate-ci-contract.mjs | Exact-SHA Green Gate required-CI residency/settlement regression | Only push/schedule/manual Green Gate wakes may dispatch required CI; workflow_run wakes are observation-only, and settlement must never redispatch missing/cancelled runs. || `RC-AUTO-REPAIR-PUBLISH-STALE-BASE-001` | AUTO_REPAIR | The repair publisher previously rebased a verified repair onto a newer execution head when the branch moved during diagnosis, allowing a stale repair to become a new execution commit and churn canonical CI. | .github/workflows/auto-repair.yml | scripts/ci/validate-auto-repair-boundary.mjs ; scripts/ci/test-auto-repair-final.mjs | A repair must publish only when local and remote execution both equal the failed target SHA; any head movement causes fail-closed publication, never rebase. |
| `RC-GREEN-GATE-PENDING-CANCELLATION-001` | CI_EVIDENCE | Daily·FLIXO Green Gate observations could be cancelled or superseded before evidence publication because concurrency grouped by branch/SHA and GitHub allows only one pending item per concurrency group. | .github/workflows/daily-flixo-green-gate.yml, scripts/ci/test-auto-repair-architecture.mjs | assert Green Gate concurrency group uses github.run_id ; assert cancel-in-progress is false |  |
| `RC-BUILD-TOOLS-CSS-PATH-001` | BUILD | src/routes/tools-page.tsx imported tools-modern.css relative to src/routes although the authoritative stylesheet is stored in src/components, causing Vite UNRESOLVED_IMPORT. | src/routes/tools-page.tsx, src/components/tools-modern.css | npm run test:build ; npm run test:static | Keep imports aligned with the authoritative module location; the stylesheet is not duplicated. |
| `RC-TASK-AGENT-LEDGER-MARKER-001` | CI_CONTRACT | Task Agent contract validation required an obsolete literal governance marker that was absent from the canonical المهام.md ledger, causing a contract failure even after the ledger filename was corrected. | المهام.md, scripts/ci/validate-task-agent-contract.mjs | npm run test:task-agent ; npm run test:static | Critical governance invariants must be stated explicitly in the canonical ledger and validated from that single authority. |
| `RC-BROWSER-FIREFOX-NETWORKIDLE-001` | BROWSER | Firefox DEEP localization/SEO coverage intermittently timed out waiting for Playwright networkidle even though load completed and page assertions/runtime checks otherwise progressed. Chromium and WebKit on the same exact SHA did not reproduce the pattern. | tests/official/g4-localization-runtime.spec.ts | FLIXO Test System Browser DEEP on exact SHA across Firefox/Chromium/WebKit | Use deterministic document readiness, font readiness, animation-frame, and idle-callback settling for this local static/runtime contract instead of browser-dependent networkidle quiescence. |
| `RC-AUTOREPAIR-EXPECTED-SHA-001` | AUTO_REPAIR | Auto Repair Phase 1 previously failed with EXPECTED_SHA_MISSING even though the target resolver wrote the failed SHA file. | .github/workflows/auto-repair.yml | Phase 1 preflight on exact failed SHA with FLIXO_EXPECTED_TARGET_SHA ; verified-repair handoff gate | Propagate the exact target SHA through GITHUB_ENV and retain independent file proof. |
| `RC-AUTOREPAIR-STRATEGY-CASCADE-001` | AUTO_REPAIR | Downstream postflight/learning steps could emit a secondary missing strategy artifact error after an upstream strategy/preflight failure. | .github/workflows/auto-repair.yml | Auto Repair failure-path execution ; no secondary strategy artifact exception | Gate dependent AI phases on upstream success and explicitly fail closed when strategy evidence is absent. |
| `RC-I18N-HOME-HEROTITLE-MARKUP-001` | I18N | Effective localization verification failed for ms and uk because HOME_COPY_OVERRIDES used raw HTML <span> tags in heroTitle while the canonical Home contract uses [[...]] presentation markers rendered by AgentFirstHome. | src/lib/i18n/locale-quality-overrides.ts, src/data/home-locales.ts, src/components/AgentFirstHome.tsx | validate:effective-localization ; FLIXO WP0 Trust Baseline ; canonical Test System | Home heroTitle localization data must use the canonical [[...]] marker contract; presentation HTML is produced by AgentFirstHome only. |
| `RC-WATCH-API-RATE-LIMIT-001` | CI_CONCURRENCY | The execution watchdog made multiple GitHub installation-API calls per observer wake while retaining non-canceling same-SHA concurrency. Repeated required-workflow completions accumulated observer runs, consumed installation API quota, and converted stale or superseded observation events into noisy watchdog failures. | .github/workflows/execution-bot-watchdog.yml, scripts/ci/test-repair-supervision-contract.mjs | npm run validate:ci-contract ; node scripts/ci/test-repair-supervision-contract.mjs ; next exact-SHA required-workflow completion leaves at most one surviving watchdog wake per source SHA | Watchdog observation is supersedable per exact source SHA (cancel-in-progress=true); source-head reads use public git ref resolution instead of installation API polling; the evidence-bearing Green Gate remains non-canceling. |

| `RC-WATCH-PUSH-SUPERSESSION-001` | CI_CONCURRENCY | The execution watchdog failed an older push event when the execution branch had already advanced, because the push path required EVENT_SHA to equal the live execution head instead of classifying the event as stale. | .github/workflows/execution-bot-watchdog.yml, scripts/ci/test-repair-supervision-contract.mjs | Watchdog supervision contract regression on the exact execution branch | Superseded push events must enter STALE_WATCHDOG_EVENT and skip the wake path; only the current exact execution head may wake canonical CI. |
## 5. Historical repair knowledge

| Knowledge ID | Root cause | Rule | Lesson | Evidence |
|---|---|---|---|---|
| `hist-evidence-reasoning` | diagnosis | `evidence-first-reasoning` | Use evidence-first causal reasoning before mutation; ambiguity blocks mutation. | 75a6780f760de6acde2a69affc5104e634667596 / run 35424403916 |
| `hist-exact-source` | lint | `exact-source-location` | Require a verified exact source location before deterministic lint mutation. | 75a6780f760de6acde2a69affc5104e634667596 / run 35424403916 |
| `hist-external-isolation` | external-tooling | `external-provider-isolation` | Separate provider/tooling failures from source-repair attempts; remain fail-closed. | 75a6780f760de6acde2a69affc5104e634667596 / run 35427463513 |
| `hist-historical-rollback` | recurrence | `proof-gated-historical-rollback` | A verified historical repair can be reverted only after ancestry, policy, causal proof and regression checks; preserve provenance. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-revert-antipattern` | recurrence | `block-reverted-rule-repetition` | A rule that caused a verified historical rollback becomes an anti-pattern and cannot be blindly reapplied. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-cross-fingerprint` | learning | `cross-fingerprint-generalization` | Generalize a playbook only after distinct fingerprints provide repeated successful evidence; never infer generality from one case. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-unbounded-supervision` | orchestration | `supervised-cycle-continuation` | Outer repair supervision may continue across fresh canonical failures while each individual mutation/verification cycle remains bounded. | 75a6780f760de6acde2a69affc5104e634667596 / run 35425840484 |
| `hist-stale-recursion` | orchestration | `reject-stale-failure-targets` | Do not recursively target stale failures; bind each cycle to the authoritative active failure SHA/run. | 75a6780f760de6acde2a69affc5104e634667596 / run 35424403916 |
| `hist-isolated-diagnostics` | trust-boundary | `isolate-agent-diagnostics` | Keep Task Agent diagnostics and learning state outside the repair worktree so evidence cannot contaminate source mutation. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-debt-fingerprint` | technical-debt | `deterministic-finding-fingerprint` | Technical-debt findings require deterministic fingerprints so repeated audits identify the same defect without duplicate learning. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-pre-mutation-selftest` | trust-boundary | `self-test-before-mutation` | Run the repair-agent architecture/self-test before allowing mutation. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-exact-scout` | evidence | `fresh-exact-sha-scout` | Scout evidence must be fresh and bound to the exact target SHA before it can influence repair. | 75a6780f760de6acde2a69affc5104e634667596 / run 35420543755 |
| `hist-repair-preflight-recursion` | orchestration | `block-preflight-recursion` | When the repair agent fails before RCA at an immutable boundary or control-plane preflight, stop identical recursive dispatch and change the dispatcher strategy first. | 83b077936ef0130cd635cdfa433ea9bebea9a4a4 / run 35474186515; 83b077936ef0130cd635cdfa433ea9bebea9a4a4 / run 35474291055; 83b077936ef0130cd635cdfa433ea9bebea9a4a4 / run 35474346798 |
| `hist-gh-cli-query-shape` | orchestration | `gh-cli-json-jq-contract` | Treat GitHub CLI command syntax as repair code: structured JSON should be piped to jq for --arg filtering instead of mixing unsupported gh --jq and jq options. | 83b077936ef0130cd635cdfa433ea9bebea9a4a4 / run 35474291055; 89cee10f43acf1244d064dab19f9a351b8acafcf / run 35474371698 |
| `hist-regex-contract-escaping` | lint | `regex-contract-escape-discipline` | In CI source assertions, distinguish JavaScript RegExp escaping from YAML/shell quoting and verify the exact emitted workflow literal before publication. | 89cee10f43acf1244d064dab19f9a351b8acafcf / run 35474433320; cc208a65323355b8846d7aa6d7e85f742feb8909 / run 35474506727 |
| `hist-canonical-registry-symmetry` | architecture | `canonical-registry-symmetry` | A new repair-control workflow is incomplete until the workflow, validator, supervisor and canonical control-plane registry agree on its identity and authority. | b7676df7aa32ad7e718f524ad84aa826d3b28b6c / run 35474506727; 11a69c066357a565d2cc26afd516d4b2d1eb6f7b / run 35474573378 |
| `hist-primary-red-order` | orchestration | `primary-red-before-secondary-certification` | When multiple gates fail on one SHA, repair the earliest canonical gate first; downstream certification/browser errors can be secondary symptoms of an earlier static/control-plane defect. | 83b077936ef0130cd635cdfa433ea9bebea9a4a4 / run 35474371698; 11a69c066357a565d2cc26afd516d4b2d1eb6f7b / run 35474573378 |

## 6. Recent execution learning / repair outcomes

## EXECUTION LEARNING

```text
RC-023 = Technical-debt dependency audit used GNU grep -E with an unsupported PCRE non-capturing group and swallowed parser errors, producing false unreferenced-dependency evidence.
FIX = 8c90d429bb7ecf41ac578a841f4ec3282476aed1
VERIFIED = CI RUN 35422251044 on exact SHA 8c90d429; stale for closure after execution advanced to 738676c.
PREVENTION = fail closed on grep/tool errors other than exit status 1, use POSIX ERE, scope usage evidence to source files, and assert producer stderr is empty.

RC-024 = GitHub Advanced Security Code Scanning AI repeatedly rejected the configured Copilot model with CAPI 400 "The requested model is not supported".
EVIDENCE = runs 35422058941, 35422055397, 35422052291, 35422047947, 35422635168, and current check on execution 738676c.
STATUS = BLOCKED_EXTERNAL.
PREVENTION = classify provider model rejection as external infrastructure; do not mutate source code, weaken required checks, bypass certification, or rerun blindly.
```

RC-027 = Canonical CI contract validator contained a no-useless-escape lint error in its regex literal; repaired without changing contract semantics.
VERIFICATION = WP0 + Canonical CI on the resulting exact SHA.

RC-028 = TanStack Router typed route literal mismatch in `src/routes/tools-page.tsx`: `/ar/` was not a registered route literal; exact-head WP0 typecheck rejected it.
FIX = normalize the navigation links to the registered `/ar` route literal.
VERIFICATION = `npm run typecheck` + router contract on the new exact SHA.
PREVENTION = route links must use generated TanStack route literals or route templates/params, not hand-authored trailing-slash variants.

RC-030 = Canonical CI contract validator falsely rejected Daily Green Gate evidence handling because its multiline regex joined an `gh run view --log-failed` command to an unrelated intentional `|| true` on a later `gh run list` command.
FIX = scope the forbidden pattern to individual command lines.
VERIFICATION = fresh WP0 canonical static run on the resulting exact SHA.
PREVENTION = never use cross-command multiline regexes for shell safety assertions when command-local matching is sufficient.

RC-031 = `validate-agent-protocol.mjs` asserted an obsolete auto-repair reproduction marker after the engine refactored reproduction ownership to `evidence.reproductionSelection.commands`.
FIX = update the validator to enforce the current authoritative engine marker.
VERIFICATION = fresh WP0/static on the exact execution SHA.
PREVENTION = update contract assertions atomically with protocol/engine migrations; never require historical implementation strings as certification evidence.

RC-032 = Continuous-error-watch self-test expected `RED_INTERNAL` without `EVIDENCE_CAPTURE=AVAILABLE`; under the current fail-closed contract this correctly resolves to `FAIL_CLOSED`.
FIX = make the internal RED fixture provide explicit evidence.
VERIFICATION = watcher self-test on the exact execution SHA.
PREVENTION = missing evidence must never be used to manufacture an internally repairable RED.

RC-033 = Daily Green Gate accumulated duplicate watcher runs because workflow_run events shared one non-canceling global concurrency lane.
FIX = branch-scoped superseding watcher concurrency; Auto-Repair remains non-canceling.
VERIFICATION = concurrency contract + exact-SHA watcher self-test.
PREVENTION = observer workflows are supersedable; mutation workflows remain serialized.

RC-034 = Auto-Repair publication could rebase a verified repair onto a newer `execution` head after the target moved during diagnosis, creating stale repair commits and repeatedly canceling fresh canonical CI.
FIX = require local base == failed target SHA == remote execution SHA before commit, and require remote execution to equal the repair commit parent before push; remove stale rebase fallback.
VERIFICATION = Auto-Repair boundary/final architecture contracts on the resulting exact SHA.
PREVENTION = execution head movement is always fail-closed during a repair cycle; verified repairs never rebase across unrelated execution mutations.

RC-035 = Canonical build verification failed because src/routes/tools-page.tsx imported tools-modern.css from the wrong directory.
FIX = use the authoritative ../components/tools-modern.css import without creating a duplicate stylesheet.
VERIFICATION = fresh exact-SHA build, WP0, and Test Impact.
PREVENTION = keep route/component asset imports aligned with their owning filesystem authority.

RC-036 = Task Agent contract validation still required an obsolete governance phrase that was missing from the canonical المهام.md ledger.
FIX = record the explicit auto-merge-after-GREEN invariant in المهام.md while keeping the validator fail-closed.
VERIFICATION = fresh Task Agent/static/WP0 evidence on exact SHA.
PREVENTION = governance invariants are declared once in the executable ledger and verified there.

RC-037 = Firefox DEEP localization runtime checks intermittently timed out on Playwright networkidle while load/runtime assertions were otherwise healthy.
FIX = replace the browser-dependent networkidle wait with deterministic load + document.fonts.ready + double requestAnimationFrame + idle callback settling.
VERIFICATION = fresh canonical Browser FAST/DEEP execution on the exact SHA across all three engines.
PREVENTION = do not use networkidle as the synchronization primitive for this local static contract unless the application explicitly requires network quiescence.


RC-038 = Auto Repair Phase 1 previously failed with EXPECTED_SHA_MISSING despite target-file evidence existing.
FIX = propagate FLIXO_EXPECTED_TARGET_SHA through the job environment and retain file checks.
VERIFICATION = exact failed-SHA Phase 1 preflight and verified-repair handoff.

RC-039 = Auto Repair downstream postflight could mask the primary RED with a missing strategy artifact error.
FIX = gate dependent phases on upstream success and fail closed on missing strategy data.
VERIFICATION = next real Auto Repair failure/repair cycle.

RC-041 = Effective Home heroTitle markup mismatch for ms/uk caused the localization gate to reject raw <span> overrides.
RC-042 = PROJECTS.md retained a stale main SHA and obsolete canonical PR references after the execution→main topology was consolidated, causing live-state documentation to point at non-current verification targets.
FIX = reconcile the live state with verified main b80dbf2 and canonical PR #759 while keeping mutable execution/PR heads as live references rather than duplicated values.
VERIFICATION = re-read current main/execution refs and PR #759; fresh canonical CI remains required for GREEN.
PREVENTION = keep mutable execution state out of duplicated hardcoded fields and update topology references atomically with governance changes.
FIX = normalize the effective ms/uk heroTitle overrides to the canonical [[...]] marker contract.
VERIFICATION = validate:effective-localization + WP0 + canonical browser CI on the exact execution SHA.
PREVENTION = presentation HTML belongs to AgentFirstHome; localization data stores semantic markers only.

## 7. How to use this file

For every future Action RED, append/derive:

`runId → exact SHA → workflow/job → fingerprint → RCA → repair commit → targeted regression → canonical CI result → final outcome → prevention lesson`

A failure is not considered repaired merely because code changed. The durable terminal outcomes are `verified-repair`, `reverted-repair`, `blocked-external`, or an explicit unresolved/failed state.
