Audit baseline: execution `653e84d508bfc1d95f0c1547a2e973b277cd1680` and main `263827228cbe5f4851470297fde5f2858ff844de`.

## Current registry
- 43 tool definitions are currently present in `src/config/canonical-tool-definition.ts`.
- 10 are in the frozen canonical executable MVP set.
- 42 are marked ready by the current static-route generator; the five Wave 1 image tools below are explicitly classified `EXPERIMENTAL` and remain outside the frozen MVP executable set.
- `TOOL_REGISTRY` is the canonical registry and `TOOL_CATALOG` is derived from it.
- `src/config/tools.ts` remains a compatibility surface; it is not a second source of definitions.

## Current registered IDs
filter-mask, image-compressor, background-remover, image-upscaler, image-converter, object-remover, watermark-remover, image-cropper, image-to-svg, image-ocr, background-blur, passport-photo-maker, watermark-adder, meme-generator, collage-maker, image-effects, exif-cleaner, svg-optimizer, mockup-generator, seed, pix, ai-image-generator, photo-colorizer, video-trimmer, video-cropper, video-resizer, video-compressor, image-resizer, image-hue, image-pixelate, image-padding, image-rounded-corners.

## Current executable MVP IDs
background-remover, image-upscaler, image-cropper, image-compressor, image-converter, image-effects, video-trimmer, video-cropper, video-resizer, video-compressor.

## Wave 1 experimental admission
- image-resizer
- image-hue
- image-pixelate
- image-padding
- image-rounded-corners
Each has a browser-local executor path, parameter schema, intent phrases, localized SEO identity for all 20 canonical locales, and Chromium functional evidence (5/5 PASS). G4 localization/SEO verification passes 44/44 locally, including these new routes.
These tools are not promoted into the frozen MVP executable set and are not represented as autonomous agents.

## Localization baseline
The repository declares 20 canonical locales:
ar, en, es, fr, de, hi, id, it, ja, ko, ms, nl, pl, pt, ru, sv, th, tr, uk, vi.
Automated dictionary structure/key coverage passes all 20 canonical locale dictionaries, with no non-canonical locale dictionary files remaining. Full hardcoded UI-string migration is not yet certified.

## Dependency and privacy baseline
Production dependency audit currently reports zero high/critical/moderate vulnerabilities in runtime dependencies.
PDF, FFmpeg, advanced OCR/AI, and other heavy browser-local engines remain excluded until licensing, bundle, browser-compatibility, privacy, worker/cancellation, and verifier contracts are satisfied.
The strict no-upload claim still requires dedicated network-interception evidence for every admitted capability.

## Architecture gaps for the 200-tool program
1. Shared capability engines for PDF, advanced media codecs, audio processing, OCR, and local AI remain to be added where required.
2. Heavy operations need worker boundaries, cancellation, and resource budgets.
3. New tools must continue using the canonical registry/admission pattern without introducing a second registry.
4. Every additional tool requires executor, verifier, recovery, schema, localization, privacy, browser, performance, and E2E evidence.
5. The current 200-tool list remains a target catalog, not evidence that 200 implementations exist.
6. Cloud-dependent capabilities remain excluded from the strict browser-local tool count unless an equivalent local implementation is verified.

## Verified repair history
- The shared image-toolkit route crash caused by missing canonical `toolId` injection was repaired and promoted through PR #1000.
- The production identity probe transiently returned 404 immediately after deploy on main SHA `263827228cbe5f4851470297fde5f2858ff844de`; the production job was rerun and subsequently passed immutable identity and production browser verification.
- The G4 localization suite had an async H1 race; its navigation helper now waits for non-empty H1 content before asserting localized route metadata. The repaired local suite is 44/44 PASS.

## Gate status
This audit does not certify the 200-tool program. The current production release is verified on main SHA `263827228cbe5f4851470297fde5f2858ff844de`. The next work is controlled expansion of the target catalog while preserving the frozen MVP boundary, exact-SHA evidence, localization coverage, privacy verification, and fail-closed release gates.
