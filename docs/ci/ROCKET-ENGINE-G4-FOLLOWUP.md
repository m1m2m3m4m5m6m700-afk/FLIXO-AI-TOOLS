# Rocket CI / G4 Follow-up

The G4 runtime matrix exposed two application-level defects that must be fixed without weakening the contract:

1. Localized tool routes must have exactly one `<main>` landmark. The canonical localized page shell owns `<main>`; tool implementations must not introduce another page-level `<main>`.
2. The canonical localized page owns the sole page-level `<h1>`. Tool implementations must not render a hard-coded English `<h1>` that bypasses localized SEO names.

Fix these at the application source, then rerun only affected localization routes before escalating to the full matrix.
