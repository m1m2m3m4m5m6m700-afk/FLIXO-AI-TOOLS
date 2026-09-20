-- FLIXO external GPT council runtime schema.
-- The same schema is applied to Supabase project zrpsmgdrtwzrhkjwwujo.
-- RLS is enabled and only server-side service-role access is permitted.

create table if not exists public.flix_council_accounts (
  account_id text primary key check (account_id in ('CHIEF','WORKER_A','WORKER_B')),
  role text not null check (role in ('CHIEF','WORKER_A','WORKER_B')),
  transport text not null check (transport in ('PUSH','POLL','HYBRID')),
  endpoint_env text,
  token_env text not null,
  active boolean not null default true,
  lease_seconds integer not null default 120 check (lease_seconds between 15 and 3600),
  current_session_id text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flix_council_dispatches (
  dispatch_id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  idempotency_key text not null unique,
  task_id text not null,
  work_package_id text not null,
  entry_sha text not null check (entry_sha ~ '^[0-9a-f]{40}$'),
  primary_account_id text not null references public.flix_council_accounts(account_id),
  fallback_account_id text not null references public.flix_council_accounts(account_id),
  recipient_account_id text not null references public.flix_council_accounts(account_id),
  handoff_account_id text not null default 'CHIEF' references public.flix_council_accounts(account_id),
  status text not null check (status in ('LEASED','ACKED','DONE','FAILED','CANCELLED','EXPIRED')),
  payload jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  session_id text,
  lease_expires_at timestamptz,
  acked_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 1 check (attempts >= 0 and attempts <= 20),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flix_council_events (
  event_id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references public.flix_council_dispatches(dispatch_id) on delete cascade,
  account_id text references public.flix_council_accounts(account_id),
  event_type text not null check (event_type in ('DISPATCHED','ACKED','HEARTBEAT','COMPLETED','FAILED','EXPIRED','HANDOFF_READY','WAKE_PUSH_FAILED')),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.flix_council_accounts enable row level security;
alter table public.flix_council_dispatches enable row level security;
alter table public.flix_council_events enable row level security;

revoke all on public.flix_council_accounts from anon, authenticated;
revoke all on public.flix_council_dispatches from anon, authenticated;
revoke all on public.flix_council_events from anon, authenticated;

-- Apply the accompanying RPC functions from:
-- council_external_accounts_dispatch_leases_v1
-- council_external_lease_recovery_v1

-- Authoritative lease/dispatch RPCs.
-- Security boundary:
--   * SECURITY DEFINER with fixed search_path
--   * EXECUTE only for service_role
--   * every worker mutation is bound to recipient account, session and exact SHA
--   * claim/recovery use row locks + SKIP LOCKED for single-winner semantics
--   * recovery reassigns to the canonical fallback account without trusting client state

create or replace function public.council_claim_dispatch(p_account_id text)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
  v_session_id text;
begin
  if p_account_id not in ('CHIEF','WORKER_A','WORKER_B') then
    raise exception 'COUNCIL_ACCOUNT_INVALID';
  end if;

  perform 1
    from public.flix_council_accounts
   where account_id = p_account_id
     and active = true
   for update;
  if not found then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  select *
    into v_dispatch
    from public.flix_council_dispatches
   where recipient_account_id = p_account_id
     and status = 'LEASED'
     and session_id is null
     and lease_expires_at is not null
     and lease_expires_at > now()
   order by created_at asc
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  v_session_id := gen_random_uuid()::text;

  update public.flix_council_dispatches
     set session_id = v_session_id,
         updated_at = now()
   where dispatch_id = v_dispatch.dispatch_id
  returning * into v_dispatch;

  return next v_dispatch;
end;
$$;

create or replace function public.council_ack_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text
)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
begin
  if p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'COUNCIL_EXACT_SHA_INVALID';
  end if;

  select *
    into v_dispatch
    from public.flix_council_dispatches
   where dispatch_id = p_dispatch_id
   for update;

  if not found then
    raise exception 'COUNCIL_DISPATCH_NOT_FOUND';
  end if;
  if v_dispatch.recipient_account_id <> p_account_id then
    raise exception 'COUNCIL_ACCOUNT_MISMATCH';
  end if;
  if v_dispatch.entry_sha <> p_exact_sha then
    raise exception 'COUNCIL_EXACT_SHA_MISMATCH';
  end if;
  if v_dispatch.status <> 'LEASED' then
    raise exception 'COUNCIL_ACK_STATE_INVALID';
  end if;
  if v_dispatch.session_id is null or v_dispatch.session_id <> p_session_id then
    raise exception 'COUNCIL_SESSION_MISMATCH';
  end if;
  if v_dispatch.lease_expires_at is null or v_dispatch.lease_expires_at <= now() then
    raise exception 'COUNCIL_LEASE_EXPIRED';
  end if;

  update public.flix_council_dispatches
     set status = 'ACKED',
         acked_at = coalesce(acked_at, now()),
         updated_at = now()
   where dispatch_id = p_dispatch_id
  returning * into v_dispatch;

  insert into public.flix_council_events(
    dispatch_id, account_id, event_type, exact_sha, payload
  ) values (
    v_dispatch.dispatch_id,
    p_account_id,
    'ACKED',
    p_exact_sha,
    jsonb_build_object('sessionId', p_session_id)
  );

  return next v_dispatch;
end;
$$;

create or replace function public.council_heartbeat_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text
)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
  v_lease_seconds integer;
begin
  if p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'COUNCIL_EXACT_SHA_INVALID';
  end if;

  select *
    into v_dispatch
    from public.flix_council_dispatches
   where dispatch_id = p_dispatch_id
   for update;

  if not found then
    raise exception 'COUNCIL_DISPATCH_NOT_FOUND';
  end if;
  if v_dispatch.recipient_account_id <> p_account_id then
    raise exception 'COUNCIL_ACCOUNT_MISMATCH';
  end if;
  if v_dispatch.entry_sha <> p_exact_sha then
    raise exception 'COUNCIL_EXACT_SHA_MISMATCH';
  end if;
  if v_dispatch.status <> 'ACKED' then
    raise exception 'COUNCIL_HEARTBEAT_STATE_INVALID';
  end if;
  if v_dispatch.session_id is null or v_dispatch.session_id <> p_session_id then
    raise exception 'COUNCIL_SESSION_MISMATCH';
  end if;

  select lease_seconds into v_lease_seconds
    from public.flix_council_accounts
   where account_id = p_account_id
     and active = true
   for update;
  if not found then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  update public.flix_council_dispatches
     set lease_expires_at = now() + make_interval(secs => v_lease_seconds),
         updated_at = now()
   where dispatch_id = p_dispatch_id
  returning * into v_dispatch;

  insert into public.flix_council_events(
    dispatch_id, account_id, event_type, exact_sha, payload
  ) values (
    v_dispatch.dispatch_id,
    p_account_id,
    'HEARTBEAT',
    p_exact_sha,
    jsonb_build_object('leaseExpiresAt', v_dispatch.lease_expires_at)
  );

  return next v_dispatch;
end;
$$;

create or replace function public.council_complete_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text,
  p_status text,
  p_evidence jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb
)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
begin
  if p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'COUNCIL_EXACT_SHA_INVALID';
  end if;
  if p_status not in ('DONE','FAILED') then
    raise exception 'COUNCIL_COMPLETE_STATUS_INVALID';
  end if;

  select *
    into v_dispatch
    from public.flix_council_dispatches
   where dispatch_id = p_dispatch_id
   for update;

  if not found then
    raise exception 'COUNCIL_DISPATCH_NOT_FOUND';
  end if;
  if v_dispatch.recipient_account_id <> p_account_id then
    raise exception 'COUNCIL_ACCOUNT_MISMATCH';
  end if;
  if v_dispatch.entry_sha <> p_exact_sha then
    raise exception 'COUNCIL_EXACT_SHA_MISMATCH';
  end if;
  if v_dispatch.status <> 'ACKED' then
    raise exception 'COUNCIL_COMPLETE_STATE_INVALID';
  end if;
  if v_dispatch.session_id is null or v_dispatch.session_id <> p_session_id then
    raise exception 'COUNCIL_SESSION_MISMATCH';
  end if;
  if v_dispatch.lease_expires_at is null or v_dispatch.lease_expires_at <= now() then
    raise exception 'COUNCIL_LEASE_EXPIRED';
  end if;

  update public.flix_council_dispatches
     set status = p_status,
         evidence = coalesce(p_evidence, '{}'::jsonb),
         payload = coalesce(p_payload, v_dispatch.payload),
         completed_at = now(),
         updated_at = now()
   where dispatch_id = p_dispatch_id
  returning * into v_dispatch;

  insert into public.flix_council_events(
    dispatch_id, account_id, event_type, exact_sha, payload
  ) values (
    v_dispatch.dispatch_id,
    p_account_id,
    case when p_status = 'DONE' then 'COMPLETED' else 'FAILED' end,
    p_exact_sha,
    coalesce(p_payload, '{}'::jsonb)
  );

  if p_status = 'DONE' then
    insert into public.flix_council_events(
      dispatch_id, account_id, event_type, exact_sha, payload
    ) values (
      v_dispatch.dispatch_id,
      'CHIEF',
      'HANDOFF_READY',
      p_exact_sha,
      jsonb_build_object(
        'dispatchId', v_dispatch.dispatch_id,
        'completedBy', p_account_id,
        'status', p_status
      ) || coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return next v_dispatch;
end;
$$;

create or replace function public.council_recover_expired_dispatches(p_limit integer default 10)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dispatch public.flix_council_dispatches%rowtype;
  v_next_account text;
  v_lease_seconds integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'COUNCIL_RECOVER_LIMIT_INVALID';
  end if;

  for v_dispatch in
    select *
      from public.flix_council_dispatches
     where status in ('LEASED','ACKED')
       and lease_expires_at is not null
       and lease_expires_at <= now()
     order by lease_expires_at asc, created_at asc
     for update skip locked
     limit p_limit
  loop
    insert into public.flix_council_events(
      dispatch_id, account_id, event_type, exact_sha, payload
    ) values (
      v_dispatch.dispatch_id,
      v_dispatch.recipient_account_id,
      'EXPIRED',
      v_dispatch.entry_sha,
      jsonb_build_object(
        'previousStatus', v_dispatch.status,
        'previousSessionId', v_dispatch.session_id,
        'attempt', v_dispatch.attempts
      )
    );

    if v_dispatch.attempts >= 20 then
      update public.flix_council_dispatches
         set status = 'FAILED',
             last_error = 'LEASE_RECOVERY_ATTEMPTS_EXHAUSTED',
             updated_at = now()
       where dispatch_id = v_dispatch.dispatch_id;
      continue;
    end if;

    v_next_account := case
      when v_dispatch.recipient_account_id = v_dispatch.primary_account_id
        then v_dispatch.fallback_account_id
      when v_dispatch.recipient_account_id = v_dispatch.fallback_account_id
        then v_dispatch.primary_account_id
      else v_dispatch.fallback_account_id
    end;

    select lease_seconds into v_lease_seconds
      from public.flix_council_accounts
     where account_id = v_next_account
       and active = true
     for update;

    if not found then
      update public.flix_council_dispatches
         set status = 'FAILED',
             last_error = 'FALLBACK_ACCOUNT_INACTIVE',
             updated_at = now()
       where dispatch_id = v_dispatch.dispatch_id;
      continue;
    end if;

    update public.flix_council_dispatches
       set recipient_account_id = v_next_account,
           status = 'LEASED',
           session_id = null,
           lease_expires_at = now() + make_interval(secs => v_lease_seconds),
           attempts = attempts + 1,
           last_error = 'LEASE_EXPIRED_RECOVERY',
           updated_at = now()
     where dispatch_id = v_dispatch.dispatch_id
    returning * into v_dispatch;

    return next v_dispatch;
  end loop;
end;
$$;

revoke all on function public.council_claim_dispatch(text) from public, anon, authenticated;
revoke all on function public.council_ack_dispatch(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.council_heartbeat_dispatch(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated;

grant execute on function public.council_claim_dispatch(text) to service_role;
grant execute on function public.council_ack_dispatch(uuid, text, text, text) to service_role;
grant execute on function public.council_heartbeat_dispatch(uuid, text, text, text) to service_role;
grant execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.council_recover_expired_dispatches(integer) to service_role;

