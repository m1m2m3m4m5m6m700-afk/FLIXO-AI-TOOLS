-- ADMIN-006 v2: augment the already-existing durable Admin session table.
-- The canonical Supabase provider already contains flix_admin_sessions with
-- token_hash, created_at, expires_at and last_seen_at. Preserve that schema
-- and add the provenance/revocation fields required by the current session contract.

alter table public.flix_admin_sessions
  add column if not exists session_id uuid,
  add column if not exists actor_subject text,
  add column if not exists actor_role text,
  add column if not exists environment text,
  add column if not exists issued_at timestamptz,
  add column if not exists revoked_at timestamptz;

update public.flix_admin_sessions
set session_id = coalesce(session_id, gen_random_uuid()),
    actor_subject = coalesce(nullif(trim(actor_subject), ''), 'unknown'),
    actor_role = coalesce(nullif(trim(actor_role), ''), 'ADMIN'),
    environment = coalesce(nullif(trim(environment), ''), 'unknown'),
    issued_at = coalesce(issued_at, created_at);

alter table public.flix_admin_sessions
  alter column session_id set not null,
  alter column actor_subject set not null,
  alter column actor_role set not null,
  alter column environment set not null,
  alter column issued_at set not null;

create unique index if not exists flix_admin_sessions_session_id_uidx
  on public.flix_admin_sessions (session_id);

create index if not exists flix_admin_sessions_subject_time_idx
  on public.flix_admin_sessions (actor_subject, issued_at desc);

create index if not exists flix_admin_sessions_revoked_idx
  on public.flix_admin_sessions (revoked_at);

alter table public.flix_admin_sessions
  add constraint flix_admin_sessions_subject_nonempty_check
  check (length(trim(actor_subject)) > 0);

alter table public.flix_admin_sessions
  add constraint flix_admin_sessions_role_nonempty_check
  check (length(trim(actor_role)) > 0);

alter table public.flix_admin_sessions
  add constraint flix_admin_sessions_environment_nonempty_check
  check (length(trim(environment)) > 0);

alter table public.flix_admin_sessions
  add constraint flix_admin_sessions_expiry_check
  check (expires_at > issued_at);

alter table public.flix_admin_sessions enable row level security;

revoke all on table public.flix_admin_sessions from anon, authenticated;
grant select, insert, update, delete on table public.flix_admin_sessions to service_role;
grant usage on schema public to service_role;
