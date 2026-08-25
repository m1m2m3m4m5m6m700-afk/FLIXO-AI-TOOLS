# Dependency Classification

The dependency audit is evidence-first. No package is removed solely because a text scan finds no import.

Classifications:

- `used`: direct source/config usage was found in the scanned roots.
- `no-source-usage-found`: no direct usage was found; this is a removal candidate, not proof of safety.
- `build-or-tooling-unconfirmed`: a dev dependency with no direct usage in scanned roots; verify build, config, and CI ownership before changing it.

Removal requires source/config evidence, successful `npm ci`, typecheck/lint/build verification, production audit, and relevant browser contracts when the package belongs to a runtime feature.
