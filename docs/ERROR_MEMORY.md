# FLIXO Error Memory

Purpose: preserve verified failures, their root causes, evidence, fixes, and prevention rules so the same class of error is not reintroduced.

## Rules

- Record only verified failures or warnings with concrete evidence.
- Separate root cause from symptoms.
- Never mark an issue fixed until CI or a reproducible check proves it.
- Prefer fixing the production code over weakening an assertion.
- Do not store secrets, API keys, user images, or personal data here.
- Add the next incident to this file after diagnosis, not before.

## Incident Index

| ID | Area | Severity | Status | Root cause |
|---|---|---:|---|---|
| F-001 | CI / E2E artifacts | Medium | Fixed | Artifact names contained `/` |
| F-002 | CI / upload action | Low | Fixed | `upload-artifact@v4` emitted Node 20 deprecation warning |
| F-003 | SEO / E2E | Medium | Fixed | Base `index.html` contained a second `meta description` |
| F-004 | E2E contract | Medium | Fixed | Assertion expected wording different from the real SEO contract |
| F-005 | E2E timing | Medium | Superseded | Test waited for presentation text before verifying output |
| F-006 | Image engine / SVG | High | Fixed in code; CI revalidation pending | `createImageBitmap()` failed to decode SVG in Chromium CI |
| F-007 | Routing / Registry | High | Fixed; CI verified | Validator used source-text route discovery and initially treated non-ready routes as expected public routes |

---

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
