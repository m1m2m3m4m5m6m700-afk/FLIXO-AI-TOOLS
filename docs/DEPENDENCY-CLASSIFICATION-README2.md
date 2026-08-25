# Dependency Classification

Dependency cleanup is evidence-first. A package is not removed merely because a source scan finds no import.

The classifier separates used dependencies from candidates and unconfirmed dev/build tooling dependencies. Removal requires install, typecheck, lint, build, production audit, and relevant runtime/browser verification.
