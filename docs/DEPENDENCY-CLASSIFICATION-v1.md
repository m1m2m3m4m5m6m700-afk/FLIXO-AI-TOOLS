# Dependency Classification

The dependency audit is evidence-first. No package is removed solely because a text scan finds no import.

- `used`: direct source/config usage found.
- `no-source-usage-found`: no direct usage found; removal candidate only.
- `build-or-tooling-unconfirmed`: dev dependency with no direct usage in scanned roots; verify build/config ownership first.

Removal requires source/config evidence, successful install, typecheck/lint/build, production audit, and relevant runtime/browser contracts.
