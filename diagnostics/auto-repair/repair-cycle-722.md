# Repair cycle 722

This cycle tracks the Auto Repair Bot -> verified-repair -> Executor handoff path.

- Executor must remain fail-closed when upstream repair is not verified.
- No bypass of the verified-repair gate is permitted.
- Root cause must be reproduced and verified on the current `main` before handoff.
- Follow-up cycle must use the current `main` SHA.
