# FLIXO 24×7 Automation Architecture

## Objective

Keep repair and automation continuously recoverable while preserving exact-SHA evidence, single-writer mutation authority, and canonical GREEN closure.

## Implemented layers

### 1. GitHub Execution Watchdog
Observes execution workflow results and exact-SHA state. It wakes the canonical Green Gate rather than dispatching Auto Repair directly and rejects stale workflow events.

### 2. GitHub Resident Heartbeat
Runs a one-minute internal heartbeat inside a five-minute scheduled wake window. Open work cannot enter sleep, idle, or terminal state.

### 3. External Council Lease Watcher
A separate scheduled observer for Supabase-backed Council leases. It uses GitHub OIDC to authenticate to the Council runtime and recover expired external-agent dispatches.

### 4. Supabase Automation Watchdog v1
Runs independently of GitHub Actions through pg_cron every minute. It calls the canonical council_recover_expired_dispatches(25) RPC, uses a transaction advisory lock to prevent overlapping recovery passes, and persists health and recovery evidence in flixo_automation_watchdog plus flixo_automation_watchdog_events.

The watchdog has no source mutation, GREEN, certification, or merge authority.

## State machine

BOOTING → HEALTHY

HEALTHY → RECOVERING when an expired lease is reclaimed.

HEALTHY or RECOVERING → DEGRADED on watchdog execution failure.

DEGRADED is an incident state; it is never evidence of GREEN.

## Recovery invariant

Workflow completion, timeout, cancellation, session loss, or lease expiry never closes open work.

Canonical response:

capture current exact SHA → recover or requalify lease → obtain fresh evidence → continue

## Next hardening layers

- Add a second independent external provider for watchdog execution.
- Expose a read-only health endpoint for external monitoring.
- Add signed cross-plane heartbeat receipts bound to exact SHA.
- Add provider-outage escalation and alerting.
- Add chaos tests for Supabase outage, GitHub Actions outage, lease split-brain, and stale SHA.
- Move to dual-provider active/standby wake once a second execution provider is available.

## Authority boundary

The external watchdog is an observer/recovery mechanism, not a second mutation controller. Source mutation remains restricted to the canonical execution lane, and closure still requires fresh exact-SHA verification plus canonical GREEN and certification.
