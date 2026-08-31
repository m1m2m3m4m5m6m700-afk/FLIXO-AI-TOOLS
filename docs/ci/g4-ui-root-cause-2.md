# G4 UI localization Root Cause

Post-#511 G4 runs continue to expose a limited set of English-first UI strings. These are handled centrally by `tool-ui-runtime-supplement.ts` without changing G4 assertions, adding allowlists, or accepting English fallback.
