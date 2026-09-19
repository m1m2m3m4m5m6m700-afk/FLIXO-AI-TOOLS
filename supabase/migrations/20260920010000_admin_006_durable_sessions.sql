-- ADMIN-006 v2: durable Admin session provenance and revocation.
-- This migration adds only the canonical session store; it does not enable production execution.

create table if not exists public.flix_admin_sessions (
  session_id uuid primary key,
  actor_subject text not null,
  actor_role text not null,
  environment text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint flix_admin_sessions_subject_nonempty_check
    check (length(trim(actor_subject)) > 0),
  constraint flix_admin_sessions_role_nonempty_check
    check (length(trim(actor_role)) > 0),
  constraint flix_admin_sessions_environment_nonempty_check
    check (length(trim(environment)) > 0),
  constraint flix_admin_sessions_expiry_check
    check (expires_at > issued_at)
);

create index if not exists flix_admin_sessions_subject_time_idx
  on public.flix_admin_sessions (actor_subject, issued_at desc);
create index if not exists flix_admin_sessions_expiry_idx
  on public.flix_admin_sessions (expires_at);
create index if not exists flix_admin_sessions_revoked_idx
  on public.flix_admin_sessions (revoked_at);

alter table public.flix_admin_sessions enable row level security;

revoke all on table public.flix_admin_sessions from anon, authenticated;
grant select, insert, update, delete on table public.flix_admin_sessions to service_role;
grant usage on schema public to service_role;
