# Admin Control Plane Error Handling

This document records the fail-closed error-handling contract for the Admin Control Plane.

- Authentication, authorization, persistence, evidence, and production identity failures must remain explicit and non-green.
- `UNAVAILABLE`, `BLOCKED`, `STALE`, and `UNKNOWN` are not successful production states.
- The Admin UI must not synthesize live operational facts when an authoritative adapter is unavailable.
- Production mutation remains locked until authorization, policy, approval, persistence, verification, evidence, and rollback requirements are proven.
