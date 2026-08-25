# Dependency Classification

Dependency cleanup is evidence-first. A package is not removed merely because a source scan finds no import.

`used` means direct source/config usage was found. `no-source-usage-found` means it is a candidate only. `build-or-tooling-unconfirmed` applies to dev dependencies that need build/config verification.

Removal requires install, typecheck, lint, build, production audit, and relevant runtime/browser verification.
