# FLIXO CI Architecture V5–V10

This directory defines the final CI architecture contracts, weighted sharding baseline, and evidence model.

Rules:
- Build is an evidence producer; consumers must not rebuild merely to consume generated artifacts.
- Change intelligence is fail-closed: unknown or dependency/workflow changes require FULL certification.
- Evidence is bound to the exact commit SHA.
- `skipped`, `missing`, failed, and expected/executed mismatches are never PASS.
- Diagnostic workflows never own merge protection.
