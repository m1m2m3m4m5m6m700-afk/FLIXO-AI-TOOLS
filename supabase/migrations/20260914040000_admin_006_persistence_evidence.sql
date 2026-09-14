-- ADMIN-006 v1.0: minimal persistence/evidence substrate.
-- Production controlled execution remains disabled.
-- The live provider is intentionally reused; no parallel store is introduced.

create table if not exists public.flix_admin_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  assertion_id text not null,
  claim_id text,
  exact_sha text not null,
  source text not null,
  evaluator text not null,
  environment text not null,
  status text not null check (status in ('VERIFIED','FAILED','BLOCKED','UNAVAILABLE','STALE','UNKNOWN')),
  freshness_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  integrity_sha256 text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(trim(assertion_id)) > 0),
  check (length(trim(exact_sha)) >= 40),
  check (length(trim(source)) > 0),
  check (length(trim(evaluator)) > 0),
  check (length(trim(environment)) > 0),
  check (length(integrity_sha256) = 64)
);

create index if not exists flix_admin_evidence_assertion_sha_idx
  on public.flix_admin_evidence (assertion_id, exact_sha);
create index if not exists flix_admin_evidence_expires_idx
  on public.flix_admin_evidence (expires_at);
create index if not exists flix_admin_evidence_status_recorded_idx
  on public.flix_admin_evidence (status, recorded_at desc);

create table if not exists public.flix_admin_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  actor_subject text not null,
  actor_role text,
  action text not null,
  capability text,
  target_type text not null,
  target_id text not null,
  exact_sha text not null,
  environment text not null,
  outcome text not null,
  correlation_id text,
  evidence_id uuid references public.flix_admin_evidence(evidence_id),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  integrity_sha256 text not null,
  created_at timestamptz not null default now(),
  check (length(trim(actor_subject)) > 0),
  check (length(trim(action)) > 0),
  check (length(trim(target_type)) > 0),
  check (length(trim(target_id)) > 0),
  check (length(trim(exact_sha)) >= 40),
  check (length(trim(environment)) > 0),
  check (length(trim(outcome)) > 0),
  check (length(integrity_sha256) = 64)
);

create index if not exists flix_admin_audit_actor_time_idx
  on public.flix_admin_audit_events (actor_subject, occurred_at desc);
create index if not exists flix_admin_audit_evidence_idx
  on public.flix_admin_audit_events (evidence_id);
create index if not exists flix_admin_audit_target_time_idx
  on public.flix_admin_audit_events (target_type, target_id, occurred_at desc);

alter table public.flix_admin_evidence enable row level security;
alter table public.flix_admin_audit_events enable row level security;

revoke all on table public.flix_admin_evidence from anon, authenticated;
revoke all on table public.flix_admin_audit_events from anon, authenticated;
grant select, insert, update, delete on table public.flix_admin_evidence to service_role;
grant select, insert, update, delete on table public.flix_admin_audit_events to service_role;

-- Retention is explicit and fail-safe: expired evidence remains queryable until a controlled
-- maintenance operation removes it; no implicit destructive trigger is introduced.
