# G3 deterministic fixtures

`prepare-fixtures.mjs` materializes the binary fixtures deterministically because the GitHub contents API used by the execution connector accepts UTF-8 source files only.

The generated files are fixed, hashed, and recorded in `manifest.json` during CI. No test creates random fixture data.
