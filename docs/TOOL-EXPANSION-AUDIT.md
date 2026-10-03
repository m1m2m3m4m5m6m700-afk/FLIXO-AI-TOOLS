# FLIXO Hub — Tool Expansion Baseline Audit

Audit baseline: execution `557e5f78f5f27bee3bca99aab0f18c29375ae29c` and main `86223d5be5cecbf7c6fa9a8af7bc79ddebc92c9f`.

## Current registry
- 27 tool definitions are currently present in `src/config/canonical-tool-definition.ts`.
- 10 are in the canonical executable MVP set.
- The remaining registered definitions are not all production-local executables; their capability state is derived from canonical capability metadata and intent registration.
- `TOOL_REGISTRY` is the canonical registry and `TOOL_CATALOG` is derived from it.
- `src/config/tools.ts` exposes only a deprecated compatibility alias; it is not a second source of definitions.

## Current registered IDs
filter-mask, image-compressor, background-remover, image-upscaler, image-converter, object-remover, watermark-remover, image-cropper, image-to-svg, image-ocr, background-blur, passport-photo-maker, watermark-adder, meme-generator, collage-maker, image-effects, exif-cleaner, svg-optimizer, mockup-generator, seed, pix, ai-image-generator, photo-colorizer, video-trimmer, video-cropper, video-resizer, video-compressor.

## Current executable MVP IDs
background-remover, image-upscaler, image-cropper, image-compressor, image-converter, image-effects, video-trimmer, video-cropper, video-resizer, video-compressor.

## Localization baseline
The repository currently declares 20 canonical locales:
ar, en, es, fr, de, hi, id, it, ja, ko, ms, nl, pl, pt, ru, sv, th, tr, uk, vi.
The locale loader has a lazy dictionary loader for all 20 declared locales. Tool SEO manifests are generated across the same locale set. Localization completeness still requires automated missing-key, untranslated-string, and runtime verification.

## Dependency baseline
Current package dependencies include React, TanStack Router, JSZip, Zod, Lucide React, Motion and related build/test tooling. PDF, FFmpeg, OCR, and ONNX/WebGPU engines are not yet represented as the required expansion engine layer and must be introduced only after license, bundle, browser-compatibility, and privacy review.

## Architecture gaps for the 200-tool program
1. Shared capability engines for PDF, advanced media codecs, audio processing, OCR, and local AI need to be added.
2. Heavy operations need worker boundaries and cancellation/budget controls.
3. The registry needs a scalable tool-definition/admission pattern without creating a second registry.
4. Every new tool needs executor, verifier, recovery, schema, localization, privacy, browser, performance, and E2E evidence.
5. A strict no-upload claim needs network interception tests and a policy for self-hosting WASM/model assets.
6. The current 200-tool list is a target catalog, not evidence that 200 implementations already exist.
7. Cloud-dependent capabilities must remain excluded from the strict browser-local tool count unless an equivalent local implementation is verified.

## Immediate CI blocker discovered and repaired
The previous CI run for execution commit `b700a17443927ecc2bc0de4acfd4d00741c61eb8` failed in lint because:
- `public/sw.js` referenced an undefined `SHELL_ASSETS` after logo assets were removed.
- `src/routes/localized-tool.tsx` retained an unused `SITE_ORIGIN` import.
Both defects were repaired on execution. The repair head is `557e5f78f5f27bee3bca99aab0f18c29375ae29c`.

## Gate status
This audit does not certify the 200-tool program. It establishes the implementation baseline and identifies the next executable work: validate the repaired execution head, then build the shared browser capability engines before admitting additional tools.
