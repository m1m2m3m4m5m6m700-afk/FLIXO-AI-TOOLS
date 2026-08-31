# Post-#511 G4 UI localization Root Cause

## Root Cause

`G4-ENGLISH-LEAKAGE-001` remained on a small set of specialized UI strings after the common localization contract landed in #511.

Observed examples included:

- `A cinematic sunset over Cairo...`
- `WebGPU WASM CPU`
- `Separate vocals / instrumental`
- `Audio waveform`
- `Encode`
- `Decode`
- `Preview Data URI`

## Contract response

These values are now covered by a centralized i18n runtime supplement. The G4 assertion is unchanged. No allowlist or English fallback was added.

## Scope

This is intentionally limited to the observed shared/specialized strings. Any further English leakage remains a real G4 failure and must be resolved from its source.
