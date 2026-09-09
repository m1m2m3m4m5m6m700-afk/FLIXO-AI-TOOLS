# B1/B2/B3 i18n runtime remediation gate

Goal: remove global DOM-wide translation work from the critical render path without changing the required localized output contract.

Current control-plane facts:

- `src/main.tsx` installs four runtime mutation systems.
- `installToolUiRuntimeLocalization()` and `installToolUiRuntimeSupplement()` observe `document.body` recursively.
- Tool pages already have a dedicated `.tool-page-modern__tool-host` and a React-owned `AutoLocalizedToolSurface` boundary.

Migration rules:

1. Preserve existing dictionaries and localized output while changing observation scope.
2. Scope tool UI compatibility translation to the active tool host.
3. Batch DOM work per animation frame where MutationObserver is still temporarily required.
4. Add regression tests for user content, placeholders, aria labels, dynamic rendering, and observer scope.
5. Remove global compatibility observers only after parity is proven.

This plan is not a release certificate. Each remediation step requires fresh exact-SHA CI evidence.
