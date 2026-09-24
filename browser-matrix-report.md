# FLIXO Browser Matrix Report

Exact SHA: 41d44f132fa27892155fa0ab47fb1452b908b380
Run: 35957628269
Workflow: .github/workflows/ci.yml

## FAST: 22 x 3 = 66

| Suite | Chromium | Firefox | WebKit |
|---|---|---|---|
| image-compressor | PASS | PASS | PASS |
| background-remover | PASS | PASS | PASS |
| image-upscaler | PASS | PASS | PASS |
| image-converter | PASS | PASS | PASS |
| ai-image-generator | PASS | PASS | PASS |
| object-remover | PASS | PASS | PASS |
| watermark-remover | PASS | PASS | PASS |
| image-cropper | PASS | PASS | PASS |
| image-to-svg | PASS | PASS | PASS |
| image-ocr | PASS | PASS | PASS |
| photo-colorizer | PASS | PASS | PASS |
| background-blur | PASS | PASS | PASS |
| passport-photo-maker | PASS | PASS | PASS |
| watermark-adder | PASS | PASS | PASS |
| meme-generator | PASS | PASS | PASS |
| collage-maker | PASS | PASS | PASS |
| image-effects | PASS | PASS | PASS |
| exif-cleaner | PASS | PASS | PASS |
| svg-optimizer | PASS | PASS | PASS |
| mockup-generator | PASS | PASS | PASS |
| seed | PASS | PASS | PASS |
| pix | PASS | PASS | PASS |

FAST uses two shards per browser. Canonical semantic conservation is 66/66 with no failing semantic suite.

## DEEP: 20 locales x 3 browsers = 60

Locales: ar, de, en, es, fr, hi, id, it, ja, ko, ms, nl, pl, pt, ru, sv, th, tr, uk, vi.

| Browser | Shards | Result | Units |
|---|---:|---|---:|
| Chromium | 7 | PASS | 20 |
| Firefox | 7 | PASS | 20 |
| WebKit | 7 | PASS | 20 |
| Total | 21 jobs | PASS | 60 |

Each browser had 460 passed DEEP test cases with 0 failed, 0 skipped, 0 timed out.

No current browser failure requires file/line RCA. Earlier PR #809 Firefox zoom failure is historical.