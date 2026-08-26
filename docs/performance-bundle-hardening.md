# Bundle & Performance Hardening

The build keeps route/tool code lazy and isolates large third-party dependency families into stable vendor chunks.

The existing JavaScript and total-asset budgets remain unchanged. The goal is to reduce the size of the application entry chunks and eliminate avoidable >500 KiB application chunks without weakening the performance gate.
