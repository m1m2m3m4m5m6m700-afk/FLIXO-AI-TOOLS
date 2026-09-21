-- Security/provenance hardening for the FLIXO Council and repair control plane.
-- The live provider already contained these relations, but they were not fully
-- represented in source control. This migration makes the schema reproducible,
-- closes public CRUD access, and owns the privileged Council RPC definitions.

create extension if not exists pgcrypto;

create table if not exists public.flix_council_accounts (
  account_id text primary key,
  role text not null check (role in ('CHIEF','WORKER_A','WORKER_B')),
  transport text not null check (transport in ('PUSH','POLL','HYBRID')),
  endpoint_env text,
  token_env text not null,
  active boolean not null default true,
  lease_seconds integer not null default 120 check (lease_seconds between 15 and 3600),
  current_session_id text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
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
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  session_id text,
  lease_expires_at timestamptz,
  acked_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 1 check (attempts between 0 and 20),
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
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.flix_repair_agent_orders (
  order_id uuid primary key default gen_random_uuid(),
  repository text not null,
  branch text not null,
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  run_id bigint,
  workflow_name text not null default '',
  job_name text not null default '',
  fingerprint text not null,
  error_class text,
  teaching_path text,
  status text not null default 'OPEN' check (status in ('OPEN','LEASED','DISPATCHED','BLOCKED_EXTERNAL','RESOLVED','STALE')),
  evidence jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts between 0 and 20),
  lease_expires_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repository, branch, exact_sha, fingerprint)
);

create table if not exists public.flix_repair_agent_events (
  event_id uuid primary key default gen_random_uuid(),
  order_id uuid references public.flix_repair_agent_orders(order_id) on delete cascade,
  event_type text not null check (event_type in ('SCAN','RED_DETECTED','INDEX_ROUTED','DISPATCH_ATTEMPT','DISPATCHED','BLOCKED_EXTERNAL','HEARTBEAT','RESOLVED','RECOVERY')),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.flix_repair_agent_config (
  id integer primary key check (id = 1),
  repository text not null default 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS',
  branch text not null default 'execution',
  enabled boolean not null default true,
  observe_interval_seconds integer not null default 60 check (observe_interval_seconds between 30 and 900),
  github_dispatch_enabled boolean not null default false,
  github_dispatch_token text,
  agent_secret_hash text not null check (agent_secret_hash ~ '^[0-9a-f]{64}$'),
  last_scan_at timestamptz,
  last_observed_sha text,
  last_action_run_id bigint,
  updated_at timestamptz not null default now()
);

create index if not exists flix_council_dispatches_fallback_idx
  on public.flix_council_dispatches (fallback_account_id, status, lease_expires_at, created_at);
create index if not exists flix_council_dispatches_poll_idx
  on public.flix_council_dispatches (recipient_account_id, status, lease_expires_at, created_at);
create index if not exists flix_council_events_account_idx
  on public.flix_council_events (account_id, created_at desc);

alter table public.flix_council_accounts enable row level security;
alter table public.flix_council_dispatches enable row level security;
alter table public.flix_council_events enable row level security;
alter table public.flix_repair_agent_config enable row level security;
alter table public.flix_repair_agent_orders enable row level security;
alter table public.flix_repair_agent_events enable row level security;
alter table public.flix_events enable row level security;

revoke all on table public.flix_council_accounts,
  public.flix_council_dispatches,
  public.flix_council_events,
  public.flix_repair_agent_config,
  public.flix_repair_agent_orders,
  public.flix_repair_agent_events,
  public.flix_events
from public, anon, authenticated;

grant all on table public.flix_council_accounts,
  public.flix_council_dispatches,
  public.flix_council_events,
  public.flix_repair_agent_config,
  public.flix_repair_agent_orders,
  public.flix_repair_agent_events,
  public.flix_events
to service_role;

grant usage on schema public to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array ARRAY[
    'flix_council_accounts',
    'flix_council_dispatches',
    'flix_council_events',
    'flix_repair_agent_config',
    'flix_repair_agent_orders',
    'flix_repair_agent_events',
    'flix_events',
    'flix_admin_audit_events',
    'flix_admin_evidence',
    'flix_admin_sessions'
  ]
  loop
    execute format('drop policy if exists deny_untrusted_%s on public.%I', table_name, table_name);
    execute format(
      'create policy deny_untrusted_%s on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function public.council_claim_dispatch(p_account_id text)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
  account_active boolean;
begin
  select active into account_active
  from public.flix_council_accounts
  where account_id = p_account_id;

  if coalesce(account_active, false) = false then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  update public.flix_council_dispatches
     set status = 'EXPIRED', updated_at = now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at < now();

  select *
    into picked
    from public.flix_council_dispatches
   where (
     (status in ('LEASED','ACKED') and recipient_account_id = p_account_id and lease_expires_at > now())
     or
     (status = 'EXPIRED' and fallback_account_id = p_account_id)
   )
   order by created_at asc
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  if picked.status = 'EXPIRED' then
    update public.flix_council_dispatches
       set status = 'LEASED',
           recipient_account_id = p_account_id,
           lease_expires_at = now() + make_interval(secs => (
             select lease_seconds from public.flix_council_accounts where account_id = p_account_id
           )),
           attempts = attempts + 1,
           updated_at = now(),
           last_error = null
     where dispatch_id = picked.dispatch_id
     returning * into picked;

    insert into public.flix_council_events(dispatch_id, account_id, event_type, exact_sha, payload)
    values (picked.dispatch_id, p_account_id, 'DISPATCHED', picked.entry_sha,
            jsonb_build_object('attempt', picked.attempts, 'fallback', true));
  end if;

  return next picked;
end;
$function$;

create or replace function public.council_ack_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
begin
  if not exists (
    select 1 from public.flix_council_accounts
    where account_id = p_account_id and active = true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'COUNCIL_ACK_SESSION_REQUIRED';
  end if;

  update public.flix_council_dispatches
     set status='ACKED',
         session_id=p_session_id,
         acked_at=coalesce(acked_at, now()),
         updated_at=now()
   where dispatch_id=p_dispatch_id
     and recipient_account_id=p_account_id
     and entry_sha=p_exact_sha
     and status='LEASED'
     and lease_expires_at > now()
   returning * into picked;

  if not found then
    raise exception 'COUNCIL_ACK_REJECTED';
  end if;

  update public.flix_council_accounts
     set current_session_id=p_session_id, last_seen_at=now(), updated_at=now()
   where account_id=p_account_id;

  insert into public.flix_council_events(dispatch_id, account_id, event_type, exact_sha, payload)
  values (p_dispatch_id,p_account_id,'ACKED',p_exact_sha,jsonb_build_object('sessionId',p_session_id));

  return picked;
end;
$function$;

create or replace function public.council_heartbeat_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
begin
  if not exists (
    select 1 from public.flix_council_accounts
    where account_id = p_account_id and active = true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'COUNCIL_HEARTBEAT_SESSION_REQUIRED';
  end if;

  update public.flix_council_dispatches d
     set lease_expires_at = now() + make_interval(secs => (
           select lease_seconds from public.flix_council_accounts where account_id=p_account_id
         )),
         session_id=p_session_id,
         updated_at=now()
   where d.dispatch_id=p_dispatch_id
     and d.recipient_account_id=p_account_id
     and d.entry_sha=p_exact_sha
     and d.status in ('LEASED','ACKED')
     and d.lease_expires_at > now()
   returning d.* into picked;

  if not found then
    raise exception 'COUNCIL_HEARTBEAT_REJECTED';
  end if;

  update public.flix_council_accounts
     set current_session_id=p_session_id,last_seen_at=now(),updated_at=now()
   where account_id=p_account_id;

  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
  values (p_dispatch_id,p_account_id,'HEARTBEAT',p_exact_sha,jsonb_build_object('sessionId',p_session_id));

  return picked;
end;
$function$;

create or replace function public.council_complete_dispatch(
  p_dispatch_id uuid,
  p_account_id text,
  p_session_id text,
  p_exact_sha text,
  p_status text,
  p_evidence jsonb,
  p_payload jsonb
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
  next_status text;
begin
  if not exists (
    select 1 from public.flix_council_accounts
    where account_id = p_account_id and active = true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'COUNCIL_COMPLETE_SESSION_REQUIRED';
  end if;

  next_status := case when p_status = 'FAILED' then 'FAILED' else 'DONE' end;

  update public.flix_council_dispatches d
     set status=next_status,
         session_id=p_session_id,
         evidence=coalesce(p_evidence,'{}'::jsonb),
         payload=coalesce(p_payload,'{}'::jsonb),
         completed_at=now(),
         updated_at=now()
   where d.dispatch_id=p_dispatch_id
     and d.recipient_account_id=p_account_id
     and d.entry_sha=p_exact_sha
     and d.status in ('LEASED','ACKED')
   returning d.* into picked;

  if not found then
    raise exception 'COUNCIL_COMPLETE_REJECTED';
  end if;

  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
  values (
    p_dispatch_id,p_account_id,
    case when next_status='DONE' then 'COMPLETED' else 'FAILED' end,
    p_exact_sha,
    jsonb_build_object('sessionId',p_session_id,'status',next_status,'evidence',coalesce(p_evidence,'{}'::jsonb),'payload',coalesce(p_payload,'{}'::jsonb))
  );

  if next_status='DONE' then
    insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values (p_dispatch_id,picked.handoff_account_id,'HANDOFF_READY',p_exact_sha,
      jsonb_build_object('sourceAccountId',p_account_id,'sessionId',p_session_id,'taskId',picked.task_id,'workPackageId',picked.work_package_id,'evidence',coalesce(p_evidence,'{}'::jsonb),'payload',coalesce(p_payload,'{}'::jsonb)));
  end if;

  return picked;
end;
$function$;

create or replace function public.council_recover_expired_dispatches(p_limit integer default 10)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
begin
  update public.flix_council_dispatches
     set status='EXPIRED', updated_at=now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at < now()
     and attempts < 2;

  for picked in
    select d.*
      from public.flix_council_dispatches d
      join public.flix_council_accounts a on a.account_id=d.fallback_account_id
     where d.status='EXPIRED'
       and d.attempts < 2
       and a.active=true
     order by d.updated_at asc
     for update of d skip locked
     limit greatest(1, least(25, p_limit))
  loop
    update public.flix_council_dispatches d
       set status='LEASED',
           recipient_account_id=d.fallback_account_id,
           lease_expires_at=now() + make_interval(secs => (
             select lease_seconds from public.flix_council_accounts where account_id=d.fallback_account_id
           )),
           attempts=d.attempts+1,
           last_error=null,
           updated_at=now()
     where d.dispatch_id=picked.dispatch_id
     returning d.* into picked;

    insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values (
      picked.dispatch_id,
      picked.recipient_account_id,
      'DISPATCHED',
      picked.entry_sha,
      jsonb_build_object('attempt',picked.attempts,'fallback',true,'automatic',true)
    );

    return next picked;
  end loop;
end;
$function$;

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
